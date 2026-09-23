#!/usr/bin/env bash
# Render Components V2 migration screens.
#   scripts/cv2/render.sh <cluster|all>
# For docs/components-v2/screens/<cluster>/<id>-{before,after}.json:
#   1. JSON -> PNG via the sibling discord-preview checkout (bun + Playwright)
#   2. <id>-before.png + <id>-after.png -> <id>.gif (1.5 s per frame, loops)
#   3. screens/gallery.png: one row per surface, before | after
# Needs: ../discord-preview (or $DISCORD_PREVIEW), bun, ffmpeg, ffprobe.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCREENS="$ROOT/docs/components-v2/screens"
PREVIEW="${DISCORD_PREVIEW:-$(cd "$ROOT/.." && pwd)/discord-preview}"
# Worktrees live outside the projects dir; fall back to the canonical checkout.
[[ -d "$PREVIEW" ]] || PREVIEW="$HOME/code/projects/discord-preview"
WIDTH=700
BG=0x313338

[[ -d "$PREVIEW" ]] || { echo "discord-preview not found at $PREVIEW (set DISCORD_PREVIEW)" >&2; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg required" >&2; exit 1; }
# Field markdown (#15) and -# subtext (#14): older renderers draw them as raw text.
MIN_PREVIEW=3c73153
git -C "$PREVIEW" merge-base --is-ancestor "$MIN_PREVIEW" HEAD 2>/dev/null ||
	{ echo "discord-preview at $PREVIEW is older than $MIN_PREVIEW; run: git -C $PREVIEW pull" >&2; exit 1; }

target="${1:?usage: render.sh <cluster|all>}"
if [[ "$target" == all ]]; then
	mapfile -t clusters < <(find "$SCREENS" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)
else
	clusters=("$target")
fi

height() { ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 "$1"; }
scaled_height() { # height after scaling to WIDTH
	local w h
	w=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$1")
	h=$(height "$1")
	echo $(((h * WIDTH / w + 1) / 2 * 2))
}

for c in "${clusters[@]}"; do
	dir="$SCREENS/$c"
	[[ -d "$dir" ]] || { echo "no screens for cluster $c" >&2; exit 1; }

	for json in "$dir"/*.json; do [[ -e "$json" ]] || continue
		png="${json%.json}.png"
		(cd "$PREVIEW" && bun run --silent render -- "$json" "$png")
	done

	for before in "$dir"/*-before.png; do
		id="$(basename "$before" -before.png)"
		after="$dir/$id-after.png"
		[[ -f "$after" ]] || continue
		h=$(( $(scaled_height "$before") > $(scaled_height "$after") ? $(scaled_height "$before") : $(scaled_height "$after") ))
		ffmpeg -loglevel error -y \
			-loop 1 -t 1.5 -i "$before" -loop 1 -t 1.5 -i "$after" \
			-filter_complex "[0]scale=$WIDTH:-2,pad=$WIDTH:$h:0:0:color=$BG,setsar=1[a];[1]scale=$WIDTH:-2,pad=$WIDTH:$h:0:0:color=$BG,setsar=1[b];[a][b]concat=n=2:v=1,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" \
			-loop 0 "$dir/$id.gif"
		echo "gif  $c/$id.gif"
	done
done

# Gallery: every surface with both frames, before | after, stacked.
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
rows=()
for before in "$SCREENS"/*/*-before.png; do
	after="${before%-before.png}-after.png"
	[[ -f "$after" ]] || continue
	hb=$(scaled_height "$before") ha=$(scaled_height "$after")
	h=$((hb > ha ? hb : ha))
	row="$tmp/row${#rows[@]}.png"
	ffmpeg -loglevel error -y -i "$before" -i "$after" -filter_complex \
		"[0]scale=$WIDTH:-2,pad=$WIDTH:$h:0:0:color=$BG,setsar=1[a];[1]scale=$WIDTH:-2,pad=$WIDTH:$h:0:0:color=$BG,setsar=1[b];[a][b]hstack=inputs=2,pad=iw:ih+16:0:0:color=$BG" \
		-frames:v 1 "$row"
	rows+=("$row")
done
if ((${#rows[@]} == 1)); then
	cp "${rows[0]}" "$SCREENS/gallery.png"
elif ((${#rows[@]} > 1)); then
	inputs=()
	for r in "${rows[@]}"; do inputs+=(-i "$r"); done
	ffmpeg -loglevel error -y "${inputs[@]}" -filter_complex "vstack=inputs=${#rows[@]}" -frames:v 1 "$SCREENS/gallery.png"
fi
((${#rows[@]})) && echo "gallery  screens/gallery.png (${#rows[@]} surfaces)"
exit 0
