import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageJsonPath = join(
	dirname(fileURLToPath(import.meta.url)),
	'../../../package.json',
)

/** Release-please version from the root package.json, such as 4.18.0. */
export const PACKAGE_VERSION: string = JSON.parse(
	readFileSync(packageJsonPath, 'utf-8'),
).version
