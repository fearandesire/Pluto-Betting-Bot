import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'

export const sha256 = (data) => createHash('sha256').update(data).digest('hex')
export function validateReleaseLock(lock) {
	if (
		lock?.schemaVersion !== 1 ||
		lock.manifestSchemaVersion !== 1 ||
		!/^[a-f0-9]{64}$/.test(lock.archiveSha256) ||
		!/^matchupimages\/releases\/[a-f0-9]{64}\/matchupimages\.tar\.gz$/.test(
			lock.objectKey,
		)
	)
		throw new Error('invalid_release_lock')
	if (
		lock.objectKey !==
		`matchupimages/releases/${lock.archiveSha256}/matchupimages.tar.gz`
	)
		throw new Error('release_key_mismatch')
	return lock
}
export function readArchive(archive, expectedDigest) {
	if (expectedDigest && sha256(archive) !== expectedDigest)
		throw new Error('archive_digest_mismatch')
	const tar = gunzipSync(archive, { maxOutputLength: 512 * 1024 * 1024 })
	const entries = [],
		seen = new Set()
	let offset = 0,
		ended = false
	while (offset + 512 <= tar.length) {
		const header = tar.subarray(offset, offset + 512)
		offset += 512
		if (header.every((byte) => byte === 0)) {
			if (
				offset + 512 > tar.length ||
				!tar.subarray(offset).every((byte) => byte === 0)
			)
				throw new Error('invalid_tar_end')
			ended = true
			break
		}
		const field = (start, length) =>
			header
				.subarray(start, start + length)
				.toString('utf8')
				.split('\0')[0]
		const checksum = Number.parseInt(field(148, 8).trim(), 8)
		let computed = 0
		for (let i = 0; i < 512; i++)
			computed += i >= 148 && i < 156 ? 32 : header[i]
		if (checksum !== computed) throw new Error('invalid_tar_checksum')
		const prefix = field(345, 155),
			name = `${prefix ? `${prefix}/` : ''}${field(0, 100)}`
		const normalized = name.replace(/\/$/, '')
		if (
			!normalized.startsWith('matchupimages/') &&
			normalized !== 'matchupimages'
		)
			throw new Error('unsafe_archive_path')
		if (
			normalized.includes('\\') ||
			normalized
				.split('/')
				.some((part) => !part || part === '.' || part === '..') ||
			path.posix.isAbsolute(normalized)
		)
			throw new Error('unsafe_archive_path')
		if (seen.has(normalized)) throw new Error('duplicate_archive_member')
		seen.add(normalized)
		const type = field(156, 1)
		if (!['', '0', '5'].includes(type))
			throw new Error('unsafe_archive_type')
		const sizeText = field(124, 12).trim()
		if (!/^[0-7]+$/.test(sizeText)) throw new Error('invalid_archive_size')
		const size = Number.parseInt(sizeText, 8)
		if (
			!Number.isSafeInteger(size) ||
			size < 0 ||
			size > 64 * 1024 * 1024 ||
			(type === '5' && size !== 0) ||
			offset + size > tar.length
		)
			throw new Error('invalid_archive_size')
		entries.push({
			name: normalized,
			directory: type === '5',
			data: tar.subarray(offset, offset + size),
		})
		offset += Math.ceil(size / 512) * 512
	}
	if (
		!ended ||
		!entries.some(
			(e) => e.name === 'matchupimages/manifest.json' && !e.directory,
		)
	)
		throw new Error('incomplete_archive')
	return entries
}
export async function packArchive(assetsRoot, output) {
	const root = path.resolve(assetsRoot),
		tree = path.join(root, 'matchupimages')
	const inspect = async (file) => {
		const stat = await fs.lstat(file)
		if (stat.isSymbolicLink() || !(stat.isDirectory() || stat.isFile()))
			throw new Error('unsafe_asset_type')
		if (stat.isDirectory())
			for (const child of await fs.readdir(file))
				await inspect(path.join(file, child))
	}
	await inspect(tree)
	const result = spawnSync(
		'tar',
		[
			'--sort=name',
			'--mtime=@0',
			'--owner=0',
			'--group=0',
			'--numeric-owner',
			'--format=ustar',
			'-cf',
			'-',
			'-C',
			root,
			'matchupimages',
		],
		{ maxBuffer: 512 * 1024 * 1024 },
	)
	if (result.error || result.status !== 0)
		throw new Error('archive_pack_failed')
	const archive = gzipSync(result.stdout, { level: 9 })
	readArchive(archive)
	if (
		path.resolve(output) === root ||
		path.resolve(output).startsWith(tree + path.sep)
	)
		throw new Error('archive_inside_assets')
	await fs.mkdir(path.dirname(path.resolve(output)), { recursive: true })
	await fs.writeFile(output, archive)
	return { archiveSha256: sha256(archive), bytes: archive.length }
}
export async function extractArchive(archive, assetsRoot, lock) {
	validateReleaseLock(lock)
	const entries = readArchive(archive, lock.archiveSha256)
	const root = path.resolve(assetsRoot)
	await fs.mkdir(root, { recursive: true })
	// A new staging directory prevents overlaying unknown files or following links.
	const stage = await fs.mkdtemp(path.join(root, '.matchup-stage-'))
	try {
		for (const entry of entries) {
			const destination = path.join(stage, entry.name)
			if (entry.directory)
				await fs.mkdir(destination, { recursive: true })
			else {
				await fs.mkdir(path.dirname(destination), { recursive: true })
				await fs.writeFile(destination, entry.data, { flag: 'wx' })
			}
		}
		return { stage, matchupRoot: path.join(stage, 'matchupimages') }
	} catch (error) {
		await fs.rm(stage, { recursive: true, force: true })
		throw error
	}
}
