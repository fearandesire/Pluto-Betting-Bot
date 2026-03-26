#!/usr/bin/env node

import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const CANONICAL_SPEC_RELATIVE_PATH = path.join(
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
const REMOTE_SPEC_URL =
	process.env.KHRONOS_SPEC_URL ||
	'https://raw.githubusercontent.com/fearandesire/khronos/main/apps/api/spec/khronos-swagger-spec-v1.json'

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

async function fetchRemoteSpec() {
	const githubToken = process.env.KHRONOS_PAT || process.env.GITHUB_TOKEN
	const headers = githubToken
		? { Authorization: `Bearer ${githubToken}` }
		: undefined

	const response = await fetch(REMOTE_SPEC_URL, { headers })
	if (!response.ok) {
		throw new Error(
			`Failed to fetch spec from ${REMOTE_SPEC_URL}: ${response.status} ${response.statusText}`,
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

	await fetchRemoteSpec()
}

main().catch((error) => {
	console.error('Unable to materialize Khronos spec', error)
	process.exit(1)
})
