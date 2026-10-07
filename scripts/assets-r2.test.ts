import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ spawnSync: vi.fn() }))
vi.mock('node:child_process', () => ({ spawnSync: mocks.spawnSync }))

import { hydrateArchive, runAssetsCommand } from './assets-r2.js'

const roots: string[] = []
afterEach(async () => {
	vi.unstubAllEnvs()
	mocks.spawnSync.mockReset()
	for (const root of roots.splice(0))
		await fs.rm(root, { recursive: true, force: true })
})
describe('authenticated release transport fails closed', () => {
	it('reports missing object without extracting or substituting a mutable key', async () => {
		const root = await fs.mkdtemp(
			path.join(os.tmpdir(), 'pluto-r2-fixture-'),
		)
		roots.push(root)
		const lockPath = path.join(root, 'lock.json'),
			objectKey = `matchupimages/releases/${'b'.repeat(64)}/matchupimages.tar.gz`
		await fs.writeFile(
			lockPath,
			JSON.stringify({
				schemaVersion: 1,
				objectKey,
				archiveSha256: 'b'.repeat(64),
				manifestSchemaVersion: 1,
			}),
		)
		vi.stubEnv('R2_ENDPOINT', 'https://fixture.r2.cloudflarestorage.com')
		vi.stubEnv('AWS_ACCESS_KEY_ID', 'synthetic-fixture')
		mocks.spawnSync.mockReturnValue({
			status: 1,
			stderr: 'NoSuchKey',
			stdout: '',
		})
		await expect(
			runAssetsCommand([
				'hydrate',
				'--dir',
				path.join(root, 'assets'),
				'--lock',
				lockPath,
			]),
		).rejects.toThrow('R2 download failed')
		expect(mocks.spawnSync).toHaveBeenCalledTimes(1)
		expect(mocks.spawnSync.mock.calls[0][1]).toContain(
			`s3://pluto-assets/${objectKey}`,
		)
		expect(await fs.readdir(root)).toEqual(['lock.json'])
	})
	it('rejects digest tampering before extraction or schema loading', async () => {
		const root = await fs.mkdtemp(
			path.join(os.tmpdir(), 'pluto-r2-fixture-'),
		)
		roots.push(root)
		await expect(
			hydrateArchive(Buffer.from('tampered'), path.join(root, 'assets'), {
				schemaVersion: 1,
				objectKey: `matchupimages/releases/${'b'.repeat(64)}/matchupimages.tar.gz`,
				archiveSha256: 'b'.repeat(64),
				manifestSchemaVersion: 1,
			}),
		).rejects.toThrow('archive_digest_mismatch')
		expect(await fs.readdir(root)).toEqual([])
	})
})
