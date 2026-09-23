Local copies of remote images used by migration surfaces, so renders are offline and deterministic.
`dump-surfaces.test.ts` swaps each remote URL for a data URL built from the file named in `IMAGE_CACHE` (fixtures/types.ts).

`imgur-*.png` are **placeholders** (solid Pluto blue): i.imgur.com returns 429 from the devbox.
Replace them with the real images (same filename) and re-run the dump + render to fix every screen.

`discord-guild-icon.png` (B1 /odds thumbnail) and `match-placeholder.jpg` (B3 `attachment://match.jpg`) are labelled **placeholders**: the guild icon is per-server, and `assets/matchupimages/` is not in the repo.
