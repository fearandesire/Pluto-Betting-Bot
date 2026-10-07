import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const index = args.indexOf('--app-root')
const root = path.resolve(
	index >= 0 ? args[index + 1] : new URL('..', import.meta.url).pathname,
)
const load = (file) =>
	import(
		pathToFileURL(path.join(root, 'dist/utils/guilds/channels', file)).href
	)
const { TEAM_REGISTRY, pairKey } = await load('image-team-aliases.js')
const { createMatchupImageResolver } = await load('matchup-image-resolver.js')
const { validateMatchupManifest } = await load('matchup-image-schema.js')
const assets = path.join(root, 'assets/matchupimages')
const manifest = validateMatchupManifest(
	JSON.parse(await fs.readFile(path.join(assets, 'manifest.json'), 'utf8')),
)
const entries = new Map(manifest.entries.map((e) => [e.pairKey, e]))
const reports = []
const resolver = createMatchupImageResolver({
	assetsRoot: assets,
	report: (reason) => reports.push(reason),
})
let count = 0
for (const sport of ['nba', 'nfl'])
	for (const away of TEAM_REGISTRY[sport])
		for (const home of TEAM_REGISTRY[sport]) {
			if (away.id === home.id) continue
			const buffer = await resolver({
				sport,
				awayTeam: away.name,
				homeTeam: home.name,
			})
			const expected = entries.get(pairKey(sport, away.id, home.id))
			if (
				!buffer ||
				createHash('sha256').update(buffer).digest('hex') !==
					expected.sha256
			)
				throw new Error(`lookup_failed:${expected.pairKey}`)
			count++
		}
for (const input of [
	{ sport: 'nfl', awayTeam: 'Bears', homeTeam: 'Bears' },
	{ sport: 'nfl', awayTeam: 'Winnipeg Jets', homeTeam: 'Florida Panthers' },
	{ sport: 'nba', awayTeam: 'New York Giants', homeTeam: 'Atlanta Hawks' },
])
	if ((await resolver(input)) !== null)
		throw new Error('invalid_identity_selected_artwork')
if (count !== 1862) throw new Error('lookup_coverage_mismatch')
console.log(
	JSON.stringify(
		{
			status: 'passed',
			releaseId: manifest.releaseId,
			pairs: manifest.entries.length,
			orderedLookups: count,
			invalidIdentitiesRejected: 3,
		},
		null,
		2,
	),
)
