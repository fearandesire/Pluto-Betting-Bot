# Contributing to Pluto

Thanks for helping improve Pluto. This repository contains an open-source Discord bot client, so contributions should stay focused on the client and its documented interfaces.

## Before you start

- Read the README and check existing documentation for the area you plan to change.
- Keep credentials, tokens, personal data, production identifiers, and private configuration out of commits.
- For a local setup, copy `.env.example` to `.env` and replace its placeholders. Mock mode is the default example configuration.
- Use Node.js 22 or newer and pnpm.

## Development workflow

1. Create a focused branch from `main`.
2. Install dependencies with `pnpm install`.
3. Make the smallest change that solves the problem.
4. Add or update tests for changed behavior.
5. Run the checks below before opening a pull request.

```bash
pnpm typecheck
pnpm test:run
pnpm build
```

Use `pnpm lint` to apply the repository's formatting and lint checks. Do not commit generated output, local environment files, dependency links, or build artifacts.

## Pull requests

- Explain the user-visible behavior and why the change is needed.
- Keep unrelated cleanup in a separate pull request.
- Include verification steps and call out any limitations or follow-up work.
- Confirm that the pull request contains no secrets or private operational details.
- For screenshots, renders or logs, upload redacted copies with `scripts/r2-upload.py` and embed the URLs; see [Visual proof uploads](#visual-proof-uploads).
- Reviewers, human and AI, start from `REVIEW.md`: it maps paths to blast radius and lists the checks for each.

Be respectful, specific, and constructive in reviews. Contributions are evaluated on correctness, maintainability, tests, and compatibility with the existing client behavior.

## Compiled runtime validation

| Rule | Enforcement |
| --- | --- |
| Package exports own bare imports. Use explicit `.js` for local imports; do not rewrite package subpaths to filesystem paths. | The build limits tsc-alias to configured local aliases. `pnpm verify:runtime` resolves and links the emitted graph with native Node. |
| Source tests and typecheck do not establish production import or startup compatibility. Validate the shipped dependency set. | `pnpm build` runs `verify:runtime`; the production Docker stage runs the same gate with networking disabled before PR verification or image publication can finish. |

The gate checks static linkage, literal dynamic import targets, and compiled
BullBoard authentication, HTML rendering, and queue summaries. It does not prove
full bot startup, external service connectivity, or live Discord behavior.

## Discord-visible fields

| Rule | Enforcement |
| --- | --- |
| Game channel topics show only the guild's `GAME_CHANNEL_TOPIC` setting (default `Enjoy the game!`). Never store identity, markers, or delivery state in a field server members can see or edit. Create game channels with `createGameChannel()`; keep per-game channel state in `game-channel-ledger.ts`. | `topic-ownership.test.ts` fails when any file other than `game-channel-topic.ts` writes a topic or a `pluto-game:` marker. `gameChannelTopic()` falls back to the default for marker-like or over-length values, and Khronos rejects them when the setting is saved. |

## Visual proof uploads

`scripts/r2-upload.py` uploads screenshots, PNG renders and logs to Cloudflare R2 and prints one public URL per file, so a PR can show visual proof that reviewers can open. It is standard-library Python 3.8+ and runs the same in cloud sessions, on local machines and in GitHub Actions. The file is vendored from the charyon plugin's `r2-upload` skill with three local patches listed in its header (literal paths before globbing, a staged body for the `aws`/`cf` uploads, escaped Markdown link text). Until those patches land upstream, keep them when you re-copy the file.

### Uploads are public and permanent

The bucket is public and nothing expires. The random path segment is the only protection. Upload redacted media only. A screenshot or log must not show tokens, API keys, cookies, emails, Discord user data, private channel or guild details, customer data or `.env` content. Crop or blur first, and read each log before uploading it. If you cannot redact something, do not upload it; describe it in the PR instead.

### Configuration

Five names. Each is read from the environment first, then from `~/.config/agent-media/r2.env` (`KEY=value` lines; `R2_ENV_FILE` points at another path). Values are never printed. A missing name is reported by name.

| Name | Kind | Cloud session | Local machine |
| --- | --- | --- | --- |
| `R2_ACCOUNT_ID` | variable | environment variable | `r2.env` |
| `R2_BUCKET` | variable | environment variable | `r2.env` |
| `R2_PUBLIC_BASE` | variable | environment variable | `r2.env` |
| `R2_ACCESS_KEY_ID` | secret | environment secret | `r2.env` |
| `R2_SECRET_ACCESS_KEY` | secret | environment secret | `r2.env` |

With `--via auto` (the default), the `cf` CLI performs the upload whenever it is on `PATH` and either key is missing. The config check only looks for `cf` on `PATH`, so then only `R2_BUCKET` and `R2_PUBLIC_BASE` are required, and `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_ACCOUNT_ID` are optional. `cf` must also be logged in: if it is not, the config check still passes and the run exits 1 at upload time. Without `cf` on `PATH` all five names are required. Exit 3 lists whichever names are still missing.

The repository owner sets these. Agents never create keys, copy them between machines, or paste them into a command line, prompt, log or PR. The values do not belong in this repository. In a cloud session the environment's network allowlist must also permit the R2 API host and the public media host.

### Commands

Run from the repository root.

```bash
python3 scripts/r2-upload.py shot.png                      # prints the public URL
python3 scripts/r2-upload.py out/*.png run.log --markdown  # ![shot](url) for images, [run](url) otherwise
python3 scripts/r2-upload.py out/*.png --json              # file, key, url, bucket, content_type, bytes, sha256, via, verified
python3 scripts/r2-upload.py --help
```

Never paste `--json` output into a PR: it contains the bucket name. `--markdown` is the format for PRs.

Files land at `<repo>/<random id>/<name>`. `<repo>` is the `origin` remote's name; `--repo NAME` overrides it. Each upload is fetched back from its public URL and compared byte for byte; `--no-verify` skips that.

### In a PR

Run the script with `--markdown` on every file you want to show (one call accepts many files and globs), and paste the output under `## Screenshots` (or `## Validation` for logs). Videos print as links because GitHub only plays its own uploads inline.

### Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Every file uploaded and read back |
| 1 | An upload or the read-back failed |
| 2 | Usage error or a file does not exist |
| 3 | Configuration missing; stderr lists the missing names |

On exit 3, stop. Tell the owner which names are missing and say in the PR which media is still owed.

### Optional: GitHub Actions

This is an example only. Do not add it as a live workflow without the owner's go-ahead.

```yaml
# - name: Upload screenshots
#   if: github.event.pull_request.head.repo.full_name == github.repository  # fork PRs get no secrets
#   env:
#     R2_ACCOUNT_ID: ${{ vars.R2_ACCOUNT_ID }}
#     R2_BUCKET: ${{ vars.R2_BUCKET }}
#     R2_PUBLIC_BASE: ${{ vars.R2_PUBLIC_BASE }}
#     R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
#     R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
#   run: python3 scripts/r2-upload.py artifacts/*.png --markdown >> "$GITHUB_STEP_SUMMARY"
```
