import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { crc32 } from 'node:zlib'
import sharp from 'sharp'
import {
	pairKey,
	TEAM_REGISTRY,
	TEAMS_REVISION,
} from '../image-team-aliases.js'
import {
	computeMatchupReleaseId,
	type MatchupImageManifest,
} from '../matchup-image-schema.js'

/** Complete isolated release: real PNG and JPEG bytes, including PNG under .jpg. */
export async function createFixtureAssets(
	dimensions = { width: 32, height: 18 },
): Promise<{
	root: string
	manifest: MatchupImageManifest
	png: Buffer
	jpeg: Buffer
}> {
	const root = await fs.mkdtemp(
		path.join(os.tmpdir(), 'pluto-matchup-fixture-'),
	)
	const image = sharp({
		create: {
			width: dimensions.width,
			height: dimensions.height,
			channels: 3,
			background: '#224466',
		},
	})
	const [png, jpeg] = await Promise.all([
		image.clone().png().toBuffer(),
		image.clone().jpeg().toBuffer(),
	])
	const manifest: MatchupImageManifest = {
		schemaVersion: 1,
		releaseId: '',
		teamsRevision: TEAMS_REVISION,
		entries: [],
	}
	for (const sport of ['nba', 'nfl'] as const) {
		await fs.mkdir(path.join(root, sport))
		for (const a of TEAM_REGISTRY[sport])
			for (const b of TEAM_REGISTRY[sport]) {
				if (a.id >= b.id) continue
				const isPng = manifest.entries.length % 2 === 0
				const key = pairKey(sport, a.id, b.id)
				const tag = Buffer.from(`Pair\0${key}`)
				let bytes: Buffer
				if (isPng) {
					const chunk = Buffer.alloc(tag.length + 12)
					chunk.writeUInt32BE(tag.length, 0)
					chunk.write('tEXt', 4, 4, 'ascii')
					tag.copy(chunk, 8)
					chunk.writeUInt32BE(
						crc32(chunk.subarray(4, chunk.length - 4)),
						chunk.length - 4,
					)
					bytes = Buffer.concat([
						png.subarray(0, png.length - 12),
						chunk,
						png.subarray(png.length - 12),
					])
				} else {
					const comment = Buffer.alloc(tag.length + 4)
					comment.writeUInt16BE(0xfffe, 0)
					comment.writeUInt16BE(tag.length + 2, 2)
					tag.copy(comment, 4)
					bytes = Buffer.concat([
						jpeg.subarray(0, 2),
						comment,
						jpeg.subarray(2),
					])
				}
				const sha256 = createHash('sha256').update(bytes).digest('hex')
				const relative = `${sport}/${a.id}_vs_${b.id}.jpg`
				manifest.entries.push({
					pairKey: pairKey(sport, a.id, b.id),
					sport,
					teams: [a.id, b.id],
					path: relative,
					sha256,
					width: dimensions.width,
					height: dimensions.height,
					mime: isPng ? 'image/png' : 'image/jpeg',
					orderIndependent: true,
					approval: {
						teams: [a.id, b.id],
						sha256,
						evidence: 'visual-review/receipt.json',
					},
					provenance: {
						kind: 'generated',
						auditId: 'I-fixture',
						sourcePath: 'fixture/generated',
					},
				})
				await fs.writeFile(path.join(root, relative), bytes)
			}
	}
	manifest.entries.sort((a, b) => a.pairKey.localeCompare(b.pairKey))
	await writeFixtureManifest(root, manifest)
	await fs.mkdir(path.join(root, 'visual-review'))
	await fs.writeFile(
		path.join(root, 'visual-review/receipt.json'),
		JSON.stringify({
			kind: 'test-fixture',
			entries: manifest.entries.map(
				({ pairKey: key, teams, sha256 }) => ({
					pairKey: key,
					teams,
					sha256,
				}),
			),
		}),
	)
	return { root, manifest, png, jpeg }
}
export async function writeFixtureManifest(
	root: string,
	manifest: MatchupImageManifest,
): Promise<void> {
	manifest.releaseId = computeMatchupReleaseId(manifest)
	await fs.writeFile(
		path.join(root, 'manifest.json'),
		JSON.stringify(manifest),
	)
}
