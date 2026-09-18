import { readdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const distDirectory = path.resolve('dist')
const forbiddenFiles = []

async function inspectDirectory(directory) {
	const entries = await readdir(directory, { withFileTypes: true })

	for (const entry of entries) {
		const entryPath = path.join(directory, entry.name)
		const relativePath = path.relative(distDirectory, entryPath)
		const pathSegments = relativePath.split(path.sep)

		if (entry.isDirectory()) {
			if (pathSegments.includes('__tests__')) {
				forbiddenFiles.push(`${relativePath}${path.sep}`)
				continue
			}

			await inspectDirectory(entryPath)
			continue
		}

		if (/\.(?:test|spec)\./u.test(entry.name)) {
			forbiddenFiles.push(relativePath)
		}
	}
}

await inspectDirectory(distDirectory)

if (forbiddenFiles.length > 0) {
	forbiddenFiles.sort()
	console.error('Production dist contains test artifacts:')
	for (const file of forbiddenFiles) console.error(`- ${file}`)
	process.exitCode = 1
} else {
	console.log('Production dist contains no test artifacts.')
}
