#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BUCKET = 'pluto-assets'
const KEY = 'matchupimages.tar.gz'
const ASSET_DIR = path.join('assets', 'matchupimages')

const command = process.argv[2]
const dotEnvLocal = readDotEnvLocal()
const accountId = process.env.R2_ACCOUNT_ID || dotEnvLocal.R2_ACCOUNT_ID
const profile =
	process.env.R2_AWS_PROFILE || dotEnvLocal.R2_AWS_PROFILE || 'pluto-r2'

if (!['hydrate', 'upload'].includes(command)) {
	fail('Usage: node scripts/assets-r2.js <hydrate|upload>')
}

if (!accountId) {
	fail('Set R2_ACCOUNT_ID in the environment or .env.local')
}

const endpoint = `https://${accountId}.r2.cloudflarestorage.com`

if (command === 'hydrate') {
	await hydrate()
} else {
	await upload()
}

async function hydrate() {
	const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pluto-assets-'))
	const archive = path.join(workDir, KEY)

	try {
		run('aws', [
			's3',
			'cp',
			`s3://${BUCKET}/${KEY}`,
			archive,
			`--endpoint-url=${endpoint}`,
			'--profile',
			profile,
		])

		fs.mkdirSync('assets', { recursive: true })
		run('tar', ['-xzf', archive, '-C', 'assets'])

		console.log(`Hydrated ${countFiles(ASSET_DIR)} asset files`)
	} finally {
		fs.rmSync(workDir, { recursive: true, force: true })
	}
}

async function upload() {
	if (!fs.existsSync(ASSET_DIR) || !fs.statSync(ASSET_DIR).isDirectory()) {
		fail('assets/matchupimages not found. Run from repo root.')
	}

	const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pluto-assets-'))
	const archive = path.join(workDir, KEY)

	try {
		console.log(`Packing ${ASSET_DIR} to ${archive}`)
		run('tar', ['-czf', archive, '-C', 'assets', 'matchupimages'])

		const count = countFiles(ASSET_DIR)
		const size = fs.statSync(archive).size
		console.log(
			`Uploading ${count} files (${formatBytes(size)}) to s3://${BUCKET}/${KEY}`,
		)

		run('aws', [
			's3',
			'cp',
			archive,
			`s3://${BUCKET}/${KEY}`,
			`--endpoint-url=${endpoint}`,
			'--profile',
			profile,
		])

		console.log('Done.')
	} finally {
		fs.rmSync(workDir, { recursive: true, force: true })
	}
}

function run(cmd, args) {
	const result = spawnSync(cmd, args, { stdio: 'inherit', shell: false })

	if (result.error) {
		fail(
			`Failed to run ${cmd}: ${result.error.message}. Ensure ${cmd} is installed and available on PATH.`,
		)
	}

	if (result.status !== 0) {
		process.exit(result.status ?? 1)
	}
}

function readDotEnvLocal() {
	const file = '.env.local'

	if (!fs.existsSync(file)) {
		return {}
	}

	return Object.fromEntries(
		fs
			.readFileSync(file, 'utf8')
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter((line) => line && !line.startsWith('#'))
			.map((line) => {
				const index = line.indexOf('=')
				if (index === -1) {
					return []
				}

				const key = line.slice(0, index).trim()
				const value = line
					.slice(index + 1)
					.trim()
					.replace(/^['"]|['"]$/g, '')
				return [key, value]
			})
			.filter(([key]) => key),
	)
}

function countFiles(dir) {
	if (!fs.existsSync(dir)) {
		return 0
	}

	let count = 0
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const child = path.join(dir, entry.name)
		if (entry.isDirectory()) {
			count += countFiles(child)
		} else if (entry.isFile()) {
			count += 1
		}
	}

	return count
}

function formatBytes(bytes) {
	const units = ['B', 'KiB', 'MiB', 'GiB']
	let value = bytes
	let unit = units[0]

	for (let i = 1; i < units.length && value >= 1024; i += 1) {
		value /= 1024
		unit = units[i]
	}

	return `${value.toFixed(value >= 10 || unit === 'B' ? 0 : 1)} ${unit}`
}

function fail(message) {
	console.error(`ERROR: ${message}`)
	process.exit(1)
}
