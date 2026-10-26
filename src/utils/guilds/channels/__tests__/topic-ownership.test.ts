import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '../../../../..')
const OWNER = 'src/utils/guilds/channels/game-channel-topic.ts'
const TOPIC_WRITE = [
	/\btopic\s*:/,
	/[{,]\s*topic\s*[,}]/,
	/\.setTopic\s*\(/,
	/\bpluto-game:/,
]

/**
 * #604 stored a `pluto-game:<hash>` identity marker in game channel topics,
 * which server members saw. Topics hold only guild-configured text now.
 */
describe('channel topic ownership', () => {
	it('only game-channel-topic.ts writes a channel topic', async () => {
		const files = (
			await readdir(path.join(ROOT, 'src'), { recursive: true })
		)
			.map((file) =>
				path.posix.join('src', file.split(path.sep).join('/')),
			)
			.filter(
				(file) =>
					file.endsWith('.ts') &&
					file !== OWNER &&
					!file.includes('/__tests__/') &&
					!/\.(test|spec)\.ts$/.test(file),
			)
		const violations: string[] = []
		for (const file of files.sort()) {
			const lines = (await readFile(path.join(ROOT, file), 'utf8')).split(
				'\n',
			)
			lines.forEach((line, index) => {
				if (TOPIC_WRITE.some((pattern) => pattern.test(line)))
					violations.push(`${file}:${index + 1}: ${line.trim()}`)
			})
		}
		expect(
			violations,
			[
				'Channel topics are visible to server members.',
				`Create game channels with createGameChannel() from ${OWNER}; its topic comes from the guild's GAME_CHANNEL_TOPIC setting or "Enjoy the game!".`,
				'Keep channel identity and delivery state in game-channel-ledger.ts, never in a topic.',
			].join('\n'),
		).toEqual([])
	})
})
