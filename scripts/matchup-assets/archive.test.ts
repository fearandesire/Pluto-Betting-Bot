import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import {
	extractArchive,
	packArchive,
	readArchive,
	sha256,
	validateReleaseLock,
} from './archive.mjs'

const directories: string[] = []
async function fixture() {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pluto-archive-test-'))
	directories.push(root)
	await fs.mkdir(path.join(root, 'matchupimages'))
	await fs.writeFile(path.join(root, 'matchupimages/manifest.json'), '{}')
	await fs.writeFile(path.join(root, 'matchupimages/card.jpg'), 'image')
	return root
}
const lock = (bytes: Buffer) => ({
	schemaVersion: 1,
	objectKey: `matchupimages/releases/${sha256(bytes)}/matchupimages.tar.gz`,
	archiveSha256: sha256(bytes),
	manifestSchemaVersion: 1,
})
function mutateMember(bytes: Buffer, change: (header: Buffer) => void) {
	const tar = gunzipSync(bytes)
	change(tar.subarray(0, 512))
	tar.fill(32, 148, 156)
	const sum = tar.subarray(0, 512).reduce((a, b) => a + b, 0)
	tar.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii')
	return gzipSync(tar)
}
afterEach(async () => {
	for (const root of directories.splice(0))
		await fs.rm(root, { recursive: true, force: true })
})
describe('immutable safe archives', () => {
	it('packs identical bytes despite filesystem timestamps and extracts only after digest checks', async () => {
		const root = await fixture(),
			a = path.join(root, 'a.gz'),
			b = path.join(root, 'b.gz')
		await packArchive(root, a)
		await fs.utimes(
			path.join(root, 'matchupimages/card.jpg'),
			new Date(),
			new Date(),
		)
		await packArchive(root, b)
		const bytes = await fs.readFile(a)
		expect(bytes.equals(await fs.readFile(b))).toBe(true)
		expect(
			readArchive(bytes).some((e) => e.name === 'matchupimages/card.jpg'),
		).toBe(true)
		const output = path.join(root, 'hydrated')
		await expect(
			extractArchive(bytes, output, {
				...lock(bytes),
				archiveSha256: '0'.repeat(64),
				objectKey: `matchupimages/releases/${'0'.repeat(64)}/matchupimages.tar.gz`,
			}),
		).rejects.toThrow('archive_digest_mismatch')
		const extracted = await extractArchive(bytes, output, lock(bytes))
		expect(
			await fs.readFile(
				path.join(extracted.matchupRoot, 'card.jpg'),
				'utf8',
			),
		).toBe('image')
	})
	it('rejects traversal, symlinks, hardlinks, duplicate members, corrupt and incomplete tar', async () => {
		const root = await fixture(),
			archive = path.join(root, 'archive.gz')
		await packArchive(root, archive)
		const bytes = await fs.readFile(archive)
		const traversal = mutateMember(bytes, (h) => {
			h.fill(0, 0, 100)
			h.write('../escape')
		})
		expect(() => readArchive(traversal)).toThrow('unsafe_archive_path')
		for (const type of ['1', '2', 'x'])
			expect(() =>
				readArchive(mutateMember(bytes, (h) => h.write(type, 156, 1))),
			).toThrow('unsafe_archive_type')
		expect(() => readArchive(gzipSync(Buffer.alloc(1024)))).toThrow(
			'incomplete_archive',
		)
		const corrupt = gunzipSync(bytes)
		corrupt[0] ^= 1
		expect(() => readArchive(gzipSync(corrupt))).toThrow(
			'invalid_tar_checksum',
		)
		const tar = gunzipSync(bytes)
		expect(() =>
			readArchive(gzipSync(Buffer.concat([tar.subarray(0, 512), tar]))),
		).toThrow('duplicate_archive_member')
	})
	it('rejects filesystem symlinks and unresolved mutable release locks', async () => {
		const root = await fixture()
		await fs.symlink('/etc/passwd', path.join(root, 'matchupimages/linked'))
		await expect(
			packArchive(root, path.join(root, 'bad.gz')),
		).rejects.toThrow('unsafe_asset_type')
		expect(() =>
			validateReleaseLock({
				...lock(Buffer.from('x')),
				objectKey: 'matchupimages.tar.gz',
			}),
		).toThrow('invalid_release_lock')
		expect(() =>
			validateReleaseLock({
				...lock(Buffer.from('x')),
				archiveSha256: '<digest>',
			}),
		).toThrow('invalid_release_lock')
	})
})
