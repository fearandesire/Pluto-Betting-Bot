import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { restoreOriginals } from './source-originals.mjs'

const roots: string[] = []
afterEach(async () => {
	vi.unstubAllGlobals()
	for (const root of roots.splice(0))
		await fs.rm(root, { recursive: true, force: true })
})
async function fixture(drift = false) {
	const root = await fs.mkdtemp(
		path.join(os.tmpdir(), 'pluto-source-fixture-'),
	)
	roots.push(root)
	const bytes = Buffer.from('synthetic pinned source bytes'),
		file = path.join(root, 'pins.json')
	await fs.writeFile(
		file,
		JSON.stringify({
			sources: [
				{
					status: 'recovered',
					pairKey: 'nfl:bears:cardinals',
					file: 'nfl-bears-cardinals.png',
					imageUrl:
						'https://s.secure.espncdn.com/stitcher/sports/football/nfl/events/123.png?templateId=espn.com.share.1',
					sha256: drift
						? '0'.repeat(64)
						: createHash('sha256').update(bytes).digest('hex'),
				},
			],
		}),
	)
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => ({ ok: true, arrayBuffer: async () => bytes })),
	)
	return { root, file, bytes }
}
it('restores exact pinned bytes without rediscovery or artwork generation', async () => {
	const f = await fixture()
	expect(await restoreOriginals(f.file, path.join(f.root, 'cache'))).toEqual({
		restored: 1,
	})
	expect(
		await fs.readFile(path.join(f.root, 'cache/nfl-bears-cardinals.png')),
	).toEqual(f.bytes)
})
it('stops on pinned hash drift', async () => {
	const f = await fixture(true)
	await expect(
		restoreOriginals(f.file, path.join(f.root, 'cache')),
	).rejects.toThrow('pinned_source_hash_drift')
})
it('rejects an arbitrary source destination before fetching', async () => {
	const f = await fixture()
	const data = JSON.parse(await fs.readFile(f.file, 'utf8'))
	data.sources[0].imageUrl = 'http://127.0.0.1/private'
	await fs.writeFile(f.file, JSON.stringify(data))
	await expect(
		restoreOriginals(f.file, path.join(f.root, 'cache')),
	).rejects.toThrow('unsafe_pinned_source')
	expect(fetch).not.toHaveBeenCalled()
})
