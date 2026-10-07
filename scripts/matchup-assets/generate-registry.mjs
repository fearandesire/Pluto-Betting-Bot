import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = new URL('./teams.json', import.meta.url)
const data = JSON.stringify(JSON.parse(fs.readFileSync(source, 'utf8')))
const raw = `// Generated from scripts/matchup-assets/teams.json. Run assets:registry after edits.\nexport const TEAMS_REVISION = '${crypto.createHash('sha256').update(data).digest('hex')}'\nexport const TEAM_REGISTRY = ${JSON.stringify(JSON.parse(data), null, 2)} as const\n`
const generated = execFileSync(
	fileURLToPath(new URL('../../node_modules/.bin/biome', import.meta.url)),
	['format', '--stdin-file-path=image-team-data.ts'],
	{ input: raw, encoding: 'utf8' },
)
const target = new URL(
	'../../src/utils/guilds/channels/image-team-data.ts',
	import.meta.url,
)
if (process.argv.includes('--check')) {
	if (fs.readFileSync(target, 'utf8') !== generated)
		throw new Error('team_registry_drift')
} else fs.writeFileSync(target, generated)
