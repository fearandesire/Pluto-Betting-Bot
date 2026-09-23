Local copies of remote images used by migration surfaces, so renders are offline and deterministic.
`dump-surfaces.test.ts` swaps each remote URL for a data URL built from the file named in `IMAGE_CACHE` (fixtures/types.ts).

`pluto-logo.png` is the real Pluto coin logo, hosted at https://i.ibb.co/gZtJ87YV/pluto-logo.png (`plutoLogoUrl` in `src/lib/configs/constants.ts`). The bot no longer uses imgur, which is blocked in the UK.

`discord-guild-icon.png` (B1 /odds thumbnail) and `match-placeholder.jpg` (B3 `attachment://match.jpg`) are labelled **placeholders**: the guild icon is per-server, and `assets/matchupimages/` is not in the repo.
