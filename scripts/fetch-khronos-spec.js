#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const CANONICAL_SPEC_RELATIVE_PATH = path.posix.join(
	'apps',
	'api',
	'spec',
	'khronos-swagger-spec-v1.json',
)
const OUTPUT_FILE_PATH = path.resolve(
	process.cwd(),
	'generated',
	'spec',
	'khronos-swagger-spec-v1.json',
)
const LOCAL_SPEC_PATH = path.resolve(
	process.cwd(),
	'..',
	'khronos',
	CANONICAL_SPEC_RELATIVE_PATH,
)
const REPO_SPEC_PATH = path.resolve(
	process.cwd(),
	'spec',
	'khronos-swagger-spec-v1.json',
)

const DEFAULT_KHRONOS_REPO = 'fearandesire/khronos'
const KHRONOS_REPO = process.env.KHRONOS_SPEC_REPO || DEFAULT_KHRONOS_REPO
const KHRONOS_REF = process.env.KHRONOS_SPEC_REF || 'main'

// Prefer GitHub Contents API for private-repo access and stable auth behavior.
// Note: we request raw content via the Accept header.
const DEFAULT_REMOTE_SPEC_URL = `https://api.github.com/repos/${KHRONOS_REPO}/contents/${CANONICAL_SPEC_RELATIVE_PATH}?ref=${encodeURIComponent(
	KHRONOS_REF,
)}`

const REMOTE_SPEC_URL = process.env.KHRONOS_SPEC_URL || DEFAULT_REMOTE_SPEC_URL

async function ensureOutputDir() {
	await mkdir(path.dirname(OUTPUT_FILE_PATH), { recursive: true })
}

async function writeSpec(content, source) {
	await ensureOutputDir()
	await writeFile(OUTPUT_FILE_PATH, content, 'utf8')
	console.log(`Khronos spec written from ${source}`)
	console.log(`Output: ${OUTPUT_FILE_PATH}`)
}

async function tryLocalSpec() {
	try {
		await access(LOCAL_SPEC_PATH)
		const localSpec = await readFile(LOCAL_SPEC_PATH, 'utf8')
		if (!localSpec.trim()) return false

		await writeSpec(localSpec, LOCAL_SPEC_PATH)
		return true
	} catch {
		return false
	}
}

async function tryRepoSpec() {
	try {
		await access(REPO_SPEC_PATH)
		const repoSpec = await readFile(REPO_SPEC_PATH, 'utf8')
		if (!repoSpec.trim()) return false

		await writeSpec(repoSpec, REPO_SPEC_PATH)
		return true
	} catch {
		return false
	}
}

async function fetchRemoteSpec() {
	const githubToken = process.env.KHRONOS_PAT || process.env.GITHUB_TOKEN
	const headers = {
		// Request raw file bytes when hitting the Contents API URL.
		Accept: 'application/vnd.github.raw+json',
		'User-Agent': 'pluto-betting-bot/spec-fetch',
		...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
	}

	const response = await fetch(REMOTE_SPEC_URL, { headers })
	if (!response.ok) {
		const hint =
			response.status === 404 && !githubToken
				? ' (hint: repo may be private; set KHRONOS_PAT / KHRONOS_SPEC_TOKEN secret)'
				: ''
		throw new Error(
			`Failed to fetch spec from ${REMOTE_SPEC_URL}: ${response.status} ${response.statusText}${hint}`,
		)
	}

	const remoteSpec = await response.text()
	if (!remoteSpec.trim()) {
		throw new Error(`Fetched empty spec from ${REMOTE_SPEC_URL}`)
	}

	await writeSpec(remoteSpec, REMOTE_SPEC_URL)
}

async function main() {
	const localOk = await tryLocalSpec()
	if (localOk) return

	const repoSpecOk = await tryRepoSpec()
	if (repoSpecOk) return

	await fetchRemoteSpec()
}

main().catch((error) => {
	console.error('Unable to materialize Khronos spec', error)
	process.exit(1)
})
