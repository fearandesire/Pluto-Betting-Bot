#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
	extractArchive,
	packArchive,
	sha256,
	validateReleaseLock,
} from './matchup-assets/archive.mjs'
import { validateAssets } from './validate-matchup-assets.mjs'

function aws(args) {
	const endpoint =
		process.env.R2_ENDPOINT ||
		(process.env.R2_ACCOUNT_ID
			? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
			: null)
	if (
		!endpoint ||
		!/^https:\/\/[a-zA-Z0-9.-]+\.r2\.cloudflarestorage\.com$/.test(endpoint)
	)
		throw new Error('R2 endpoint is not configured')
	const profile = process.env.AWS_ACCESS_KEY_ID
		? []
		: ['--profile', process.env.R2_AWS_PROFILE || 'pluto-r2']
	const result = spawnSync(
		'aws',
		[...args, '--endpoint-url', endpoint, ...profile],
		{ encoding: 'utf8', maxBuffer: 1024 * 1024 },
	)
	if (result.error) throw new Error('AWS CLI is unavailable')
	return result
}
export async function hydrateArchive(archive, dir, lock) {
	const extracted = await extractArchive(archive, dir, lock)
	try {
		const receipt = await validateAssets(extracted.stage)
		if (
			lock.objectKey !==
			`matchupimages/releases/${lock.archiveSha256}/matchupimages.tar.gz`
		)
			throw new Error('release_key_mismatch')
		const target = path.join(path.resolve(dir), 'matchupimages')
		try {
			await fs.lstat(target)
			throw new Error(
				'hydrate_destination_exists: use a fresh assets directory',
			)
		} catch (error) {
			if (error.code !== 'ENOENT') throw error
		}
		await fs.rename(extracted.matchupRoot, target)
		return receipt
	} finally {
		await fs.rm(extracted.stage, { recursive: true, force: true })
	}
}
export async function packRelease(dir, archivePath, lockPath) {
	const receipt = await validateAssets(dir)
	const archive = await packArchive(dir, archivePath)
	const lock = {
		schemaVersion: 1,
		objectKey: `matchupimages/releases/${archive.archiveSha256}/matchupimages.tar.gz`,
		archiveSha256: archive.archiveSha256,
		manifestSchemaVersion: 1,
	}
	validateReleaseLock(lock)
	await fs.mkdir(path.dirname(path.resolve(lockPath)), { recursive: true })
	await fs.writeFile(lockPath, JSON.stringify(lock, null, 2) + '\n')
	return { ...receipt, ...archive, objectKey: lock.objectKey }
}
export async function runAssetsCommand(args) {
	const filtered = args.filter((arg) => arg !== '--'),
		command = filtered.shift()
	const flag = (name, fallback) => {
		const index = filtered.indexOf(name)
		if (index < 0) return fallback
		if (!filtered[index + 1] || filtered[index + 1].startsWith('--'))
			throw new Error(`Missing ${name} value`)
		return filtered[index + 1]
	}
	const dir = flag('--dir', 'assets'),
		lockPath = flag('--lock', 'config/matchup-assets-release.json'),
		archivePath = flag('--archive', 'assets/matchup-release.tar.gz')
	if (command === 'pack') return packRelease(dir, archivePath, lockPath)
	if (!['hydrate', 'upload'].includes(command))
		throw new Error(
			'Usage: assets-r2.js <pack|hydrate|upload> --dir <assets-root> --archive <archive> --lock <release-lock>',
		)
	const lock = validateReleaseLock(
		JSON.parse(await fs.readFile(lockPath, 'utf8')),
	)
	const bucketKey = `s3://pluto-assets/${lock.objectKey}`
	if (command === 'hydrate') {
		await fs.mkdir(path.dirname(path.resolve(dir)), { recursive: true })
		const temporary = await fs.mkdtemp(
			path.join(path.dirname(path.resolve(dir)), '.asset-download-'),
		)
		try {
			const download = path.join(temporary, 'archive.tar.gz'),
				result = aws([
					's3',
					'cp',
					bucketKey,
					download,
					'--only-show-errors',
				])
			if (result.status !== 0)
				throw new Error(
					'R2 download failed (missing object or access failure); check configured access',
				)
			return hydrateArchive(await fs.readFile(download), dir, lock)
		} finally {
			await fs.rm(temporary, { recursive: true, force: true })
		}
	}
	const bytes = await fs.readFile(archivePath)
	if (sha256(bytes) !== lock.archiveSha256)
		throw new Error('archive_digest_mismatch')
	// Verify full archive in a disposable directory before uploading.
	const verification = await fs.mkdtemp(
		path.join(path.dirname(path.resolve(dir)), '.asset-upload-check-'),
	)
	try {
		await hydrateArchive(bytes, verification, lock)
	} finally {
		await fs.rm(verification, { recursive: true, force: true })
	}
	const temporary = await fs.mkdtemp(
		path.join(path.dirname(path.resolve(dir)), '.asset-readback-'),
	)
	try {
		const existing = path.join(temporary, 'existing.tar.gz')
		const read = aws([
			's3api',
			'get-object',
			'--bucket',
			'pluto-assets',
			'--key',
			lock.objectKey,
			existing,
		])
		if (read.status === 0) {
			if (sha256(await fs.readFile(existing)) !== lock.archiveSha256)
				throw new Error('immutable_object_conflict')
		} else {
			// Only explicit object absence allows creation; auth/transport failures stop.
			if (!/NoSuchKey|\(404\)/.test(read.stderr))
				throw new Error(
					'R2 object check failed; check configured access',
				)
			const put = aws([
				's3api',
				'put-object',
				'--bucket',
				'pluto-assets',
				'--key',
				lock.objectKey,
				'--body',
				path.resolve(archivePath),
				'--if-none-match',
				'*',
			])
			if (put.status !== 0) throw new Error('R2 immutable upload failed')
		}
		const readback = aws([
			's3',
			'cp',
			bucketKey,
			existing,
			'--only-show-errors',
		])
		if (
			readback.status !== 0 ||
			sha256(await fs.readFile(existing)) !== lock.archiveSha256
		)
			throw new Error('R2 readback verification failed')
		return { status: 'uploaded-and-readback-verified', ...lock }
	} finally {
		await fs.rm(temporary, { recursive: true, force: true })
	}
}
if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		console.log(
			JSON.stringify(
				await runAssetsCommand(process.argv.slice(2)),
				null,
				2,
			),
		)
	} catch (error) {
		console.error(`Asset release failed: ${error.message}`)
		process.exitCode = 1
	}
}
