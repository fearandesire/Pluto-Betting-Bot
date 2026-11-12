#!/usr/bin/env python3
# Vendored from the charyon plugin's r2-upload skill (skills/r2-upload/scripts/r2-upload.py, 0.1.0),
# with three local patches not yet upstream: an existing path is used literally before globbing; the
# aws/cf paths upload a temp copy of the hashed bytes; --markdown escapes the link text. Keep these
# patches if you re-copy from upstream before they land there. See the visual-proof doc for usage.
# License: the plugin ships no license file for this skill, so none is added alongside it.
"""Upload media (screenshots, renders, logs) to a Cloudflare R2 bucket and print public URLs.

    python3 r2-upload.py FILE [FILE ...] [--repo NAME] [--json | --markdown] [--no-verify]
                         [--via auto|stdlib|boto3|aws|cf]

Each file goes to <R2_BUCKET>/<repo>/<random id>/<name> and its public URL is
<R2_PUBLIC_BASE>/<repo>/<random id>/<name>. The random id is the only protection (r2.dev does not
list the bucket), so objects are public and permanent: upload redacted media only.

Configuration, first found wins per name (values are never printed):
  1. environment: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE;
  2. the env file ~/.config/agent-media/r2.env (KEY=value lines; R2_ENV_FILE overrides the path);
  3. a `cf` CLI login, used for the upload when the access key pair is missing.
Optional: R2_ENDPOINT (default https://<account>.r2.cloudflarestorage.com).

Uploads use the S3 API with SigV4 signed by the standard library. --via boto3 or aws uses those
when installed; auto falls back to them only on a network or TLS failure. Each upload is read
back from the public URL and compared byte for byte unless --no-verify.

Exit: 0 all uploaded; 1 an upload or read-back failed; 2 usage; 3 configuration missing.
"""

from __future__ import annotations

import argparse
import contextlib
import datetime
import glob
import hashlib
import hmac
import json
import mimetypes
import os
import pathlib
import re
import secrets
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

NAMES = ("R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE")
KEYS = ("R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY")
TYPES = {
    ".webm": "video/webm", ".mp4": "video/mp4", ".mov": "video/quicktime", ".webp": "image/webp",
    ".svg": "image/svg+xml", ".avif": "image/avif", ".log": "text/plain", ".txt": "text/plain",
    ".md": "text/markdown", ".json": "application/json", ".jsonl": "application/x-ndjson",
    ".har": "application/json", ".csv": "text/csv", ".html": "text/html", ".gif": "image/gif",
}
TEXTUAL = ("text/", "application/json", "application/x-ndjson")
SECRETS: list[str] = []
KEEP: list[str] = []  # public, non-secret strings that the shape rules would otherwise hide


class Fail(Exception):
    def __init__(self, message: str, code: int = 1):
        super().__init__(message)
        self.code = code


def redact(text: str) -> str:
    """Remove every known secret value and anything shaped like a key or signature."""
    for value in sorted({s for s in SECRETS if s and len(s) >= 6}, key=len, reverse=True):
        text = text.replace(value, "[redacted]")
    kept = [k for k in KEEP if k]
    for i, value in enumerate(kept):
        text = text.replace(value, f"\x00{i}\x00")
    text = re.sub(r"(Credential=)[^/,\s]+", r"\1[redacted]", text)
    text = re.sub(r"(Signature=)[0-9a-fA-F]+", r"\1[redacted]", text)
    text = re.sub(r"(<(?:AWSAccessKeyId|AccessKeyId|SignatureProvided|StringToSign|CanonicalRequest)[^>]*>)[^<]*", r"\1[redacted]", text)
    text = re.sub(r"(?i)((?:secret|token|password|access[_-]?key)[\w-]*\s*[=:]\s*)\S+", r"\1[redacted]", text)
    text = re.sub(r"\b[A-Za-z0-9+/_-]{32,}\b", "[redacted]", text)
    for i, value in enumerate(kept):
        text = text.replace(f"\x00{i}\x00", value)
    return text


def env_file() -> pathlib.Path:
    custom = os.environ.get("R2_ENV_FILE")
    return pathlib.Path(custom).expanduser() if custom else pathlib.Path.home() / ".config" / "agent-media" / "r2.env"


def load_config() -> tuple[dict, list[str]]:
    """Merge env and the env file; return the values and where each came from (names only)."""
    conf = {k: os.environ[k].strip() for k in (*NAMES, "R2_ENDPOINT") if os.environ.get(k, "").strip()}
    used = ["environment"] if conf else []
    path = env_file()
    if path.is_file():
        added = False
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[7:]
            name, sep, value = line.partition("=")
            name, value = name.strip(), value.strip().strip('"').strip("'")
            if sep and name.startswith("R2_") and value and name not in conf:
                conf[name] = value
                added = True
        if added:
            used.append(str(path))
    SECRETS.extend(conf.get(k, "") for k in (*KEYS, "R2_ACCOUNT_ID"))
    KEEP.append(conf.get("R2_PUBLIC_BASE", "").rstrip("/"))
    return conf, used


def repo_name(override: str | None) -> str:
    def git(*args: str) -> str:
        try:
            done = subprocess.run(["git", *args], capture_output=True, text=True, timeout=10)
        except (OSError, subprocess.SubprocessError):
            return ""
        return done.stdout.strip() if done.returncode == 0 else ""

    name = override or ""
    if not name:
        url = git("remote", "get-url", "origin")
        name = re.sub(r"\.git$", "", url.rstrip("/").replace(":", "/").split("/")[-1]) if url else ""
    if not name:
        top = git("rev-parse", "--show-toplevel")
        name = pathlib.PurePath(top).name if top else ""
    name = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-.")
    return name or "misc"


def content_type(path: pathlib.Path) -> str:
    ctype = TYPES.get(path.suffix.lower()) or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    if ctype.startswith(TEXTUAL) and "charset" not in ctype:
        ctype += "; charset=utf-8"
    return ctype


def object_key(repo: str, path: pathlib.Path) -> str:
    name = re.sub(r"[^A-Za-z0-9._-]+", "-", path.name).strip("-") or "file"
    return f"{repo}/{secrets.token_hex(11)}/{name}"


def _hmac(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()


def signed_put(endpoint: str, bucket: str, key: str, body: bytes, ctype: str, akid: str, secret: str,
               now: datetime.datetime) -> urllib.request.Request:
    """An S3 SigV4 PUT of one object, path style, region auto (the scheme R2 documents)."""
    parts = urllib.parse.urlsplit(endpoint)
    host = parts.netloc
    path = parts.path.rstrip("/") + "/" + urllib.parse.quote(f"{bucket}/{key}", safe="/~")
    stamp, day = now.strftime("%Y%m%dT%H%M%SZ"), now.strftime("%Y%m%d")
    digest = hashlib.sha256(body).hexdigest()
    headers = {"content-type": ctype, "host": host, "x-amz-content-sha256": digest, "x-amz-date": stamp}
    signed = ";".join(sorted(headers))
    canonical = "\n".join(["PUT", path, "", *(f"{k}:{headers[k]}" for k in sorted(headers)), "", signed, digest])
    scope = f"{day}/auto/s3/aws4_request"
    to_sign = "\n".join(["AWS4-HMAC-SHA256", stamp, scope, hashlib.sha256(canonical.encode()).hexdigest()])
    k = _hmac(_hmac(_hmac(_hmac(("AWS4" + secret).encode(), day), "auto"), "s3"), "aws4_request")
    signature = hmac.new(k, to_sign.encode(), hashlib.sha256).hexdigest()
    headers["authorization"] = f"AWS4-HMAC-SHA256 Credential={akid}/{scope}, SignedHeaders={signed}, Signature={signature}"
    del headers["host"]
    return urllib.request.Request(f"{parts.scheme}://{host}{path}", data=body, headers=headers, method="PUT")


def endpoint_of(conf: dict) -> str:
    return conf.get("R2_ENDPOINT") or f"https://{conf['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com"


def put_stdlib(path: pathlib.Path, body: bytes, key: str, conf: dict) -> None:
    now = datetime.datetime.now(datetime.timezone.utc)
    request = signed_put(endpoint_of(conf), conf["R2_BUCKET"], key, body, content_type(path),
                         conf["R2_ACCESS_KEY_ID"], conf["R2_SECRET_ACCESS_KEY"], now)
    try:
        urllib.request.urlopen(request, timeout=120).close()
    except urllib.error.HTTPError as e:
        detail = e.read()[:400].decode(errors="replace")
        raise Fail(f"upload of {path} failed: HTTP {e.code} {detail}")


def put_boto3(path: pathlib.Path, body: bytes, key: str, conf: dict) -> None:
    import boto3  # noqa: PLC0415  (optional dependency)
    client = boto3.client("s3", endpoint_url=endpoint_of(conf), region_name="auto",
                          aws_access_key_id=conf["R2_ACCESS_KEY_ID"], aws_secret_access_key=conf["R2_SECRET_ACCESS_KEY"])
    try:
        client.put_object(Bucket=conf["R2_BUCKET"], Key=key, Body=body, ContentType=content_type(path))
    except Exception as e:  # noqa: BLE001  (boto3 error classes vary)
        raise Fail(f"boto3 upload of {path} failed: {e}") from None


@contextlib.contextmanager
def captured_body(body: bytes):
    """Stage the bytes that were hashed and will be read back, so a CLI never re-reads a file that may have grown."""
    with tempfile.TemporaryDirectory(prefix="r2-upload-") as tmp:
        staged = os.path.join(tmp, "body")
        with open(staged, "wb") as f:
            f.write(body)
        yield staged


def put_aws(path: pathlib.Path, body: bytes, key: str, conf: dict) -> None:
    env = {**os.environ, "AWS_ACCESS_KEY_ID": conf["R2_ACCESS_KEY_ID"],
           "AWS_SECRET_ACCESS_KEY": conf["R2_SECRET_ACCESS_KEY"], "AWS_DEFAULT_REGION": "auto"}
    env.pop("AWS_SESSION_TOKEN", None)
    env.pop("AWS_PROFILE", None)
    with captured_body(body) as staged:
        cmd = ["aws", "s3api", "put-object", "--endpoint-url", endpoint_of(conf), "--bucket", conf["R2_BUCKET"],
               "--key", key, "--body", staged, "--content-type", content_type(path)]
        done = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if done.returncode:
        raise Fail(f"aws upload of {path} failed ({done.returncode}): {(done.stderr or done.stdout).strip()[-400:]}")


def put_cf(path: pathlib.Path, body: bytes, key: str, conf: dict) -> None:
    env = dict(os.environ)
    if conf.get("R2_ACCOUNT_ID"):
        env["CLOUDFLARE_ACCOUNT_ID"] = conf["R2_ACCOUNT_ID"]
    with captured_body(body) as staged:
        cmd = ["cf", "r2", "objects", "put", key, "--bucket-name", conf["R2_BUCKET"],
               "--content-type", content_type(path), "--file", staged]
        done = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if done.returncode:
        raise Fail(f"cf upload of {path} failed ({done.returncode}): {(done.stderr or done.stdout).strip()[-400:]}")


def has_module(name: str) -> bool:
    import importlib.util  # noqa: PLC0415
    return importlib.util.find_spec(name) is not None


def plan(via: str, conf: dict) -> list[tuple[str, object]]:
    """Ordered upload methods for this run; raise Fail(code 3) naming what is missing."""
    missing = [n for n in ("R2_BUCKET", "R2_PUBLIC_BASE") if not conf.get(n)]
    keyed = all(conf.get(k) for k in KEYS)
    if via in ("stdlib", "boto3", "aws") or (via == "auto" and keyed):
        missing += [k for k in KEYS if not conf.get(k)]
        if not conf.get("R2_ENDPOINT") and not conf.get("R2_ACCOUNT_ID"):
            missing.append("R2_ACCOUNT_ID")
    elif via == "auto" and not shutil.which("cf"):
        missing += [k for k in KEYS if not conf.get(k)] + ([] if conf.get("R2_ACCOUNT_ID") else ["R2_ACCOUNT_ID"])
    if via == "cf" and not shutil.which("cf"):
        raise Fail("--via cf: the cf CLI is not on PATH", 3)
    if via == "boto3" and not has_module("boto3"):
        raise Fail("--via boto3: boto3 is not installed", 3)
    if via == "aws" and not shutil.which("aws"):
        raise Fail("--via aws: the aws CLI is not on PATH", 3)
    if missing:
        raise Fail("missing configuration: " + ", ".join(dict.fromkeys(missing))
                   + f". Set them in the environment or in {env_file()} (KEY=value lines).", 3)
    if via == "auto":
        if not keyed:
            return [("cf", put_cf)]
        methods: list[tuple[str, object]] = [("stdlib", put_stdlib)]
        if has_module("boto3"):
            methods.append(("boto3", put_boto3))
        if shutil.which("aws"):
            methods.append(("aws", put_aws))
        return methods
    return [(via, {"stdlib": put_stdlib, "boto3": put_boto3, "aws": put_aws, "cf": put_cf}[via])]


def read_back(url: str, body: bytes) -> None:
    last = ""
    for attempt in range(4):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "charyon-r2-upload"})
            with urllib.request.urlopen(request, timeout=60) as response:
                got = response.read()
            if got == body:
                return
            last = f"returned {len(got)} bytes, expected {len(body)}"
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}"
        except (urllib.error.URLError, OSError) as e:
            last = str(getattr(e, "reason", e))
        time.sleep(1.5 * (attempt + 1))
    raise Fail(f"read-back of {url} failed: {last}")


def upload(path: pathlib.Path, repo: str, conf: dict, methods: list, verify: bool) -> dict:
    body = path.read_bytes()
    key = object_key(repo, path)
    errors = []
    for name, put in methods:
        try:
            put(path, body, key, conf)
            break
        except Fail:
            raise
        except (urllib.error.URLError, OSError) as e:  # network or TLS: try the next method
            errors.append(f"{name}: {getattr(e, 'reason', e)}")
    else:
        raise Fail(f"upload of {path} failed: " + "; ".join(errors))
    url = conf["R2_PUBLIC_BASE"].rstrip("/") + "/" + urllib.parse.quote(key, safe="/~")
    if verify:
        read_back(url, body)
    return {"file": str(path), "key": key, "url": url, "bucket": conf["R2_BUCKET"], "content_type": content_type(path),
            "bytes": len(body), "sha256": hashlib.sha256(body).hexdigest(), "via": name, "verified": verify}


def markdown(item: dict) -> str:
    stem = re.sub(r"[\r\n]+", " ", pathlib.PurePath(item["file"]).stem)
    stem = re.sub(r"([\\`*_{}\[\]()<>#+!|~])", r"\\\1", stem)
    bang = "!" if item["content_type"].startswith("image/") else ""
    return f"{bang}[{stem}]({item['url']})"


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(prog="r2-upload.py", description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("files", nargs="+", help="files or glob patterns to upload")
    parser.add_argument("--repo", help="key prefix (default: origin repo name, else the git toplevel name, else misc)")
    out = parser.add_mutually_exclusive_group()
    out.add_argument("--json", action="store_true", help="print one JSON array with key, url, bytes, sha256 per file")
    out.add_argument("--markdown", action="store_true", help="print ![name](url) for images, [name](url) otherwise")
    parser.add_argument("--no-verify", action="store_true", help="skip the public read-back")
    parser.add_argument("--via", choices=("auto", "stdlib", "boto3", "aws", "cf"), default="auto")
    args = parser.parse_args(argv)

    paths = [pathlib.Path(p) for a in args.files for p in ([a] if os.path.lexists(a) else sorted(glob.glob(a)) or [a])]
    missing_files = [str(p) for p in paths if not p.is_file()]
    if missing_files:
        print("r2-upload: not a file: " + ", ".join(missing_files), file=sys.stderr)
        return 2
    results = []
    try:
        conf, _ = load_config()
        methods = plan(args.via, conf)
        repo = repo_name(args.repo)
        for path in paths:
            item = upload(path, repo, conf, methods, not args.no_verify)
            results.append(item)
            if not args.json:
                print(markdown(item) if args.markdown else item["url"], flush=True)
    except Fail as e:
        print("r2-upload: " + redact(str(e)), file=sys.stderr)
        if args.json:
            print(json.dumps(results, indent=2))
        return e.code
    except Exception as e:  # noqa: BLE001  (never let a traceback carry a secret)
        print("r2-upload: unexpected " + type(e).__name__ + ": " + redact(str(e)), file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(results, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
