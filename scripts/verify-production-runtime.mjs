import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readdir, readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import vm from 'node:vm'

// Node owns package exports and ESM linking. Never infer package paths from disk.
if (!process.execArgv.includes('--experimental-vm-modules')) {
	const child = spawnSync(
		process.execPath,
		[
			'--experimental-vm-modules',
			'--experimental-import-meta-resolve',
			fileURLToPath(import.meta.url),
			...process.argv.slice(2),
		],
		{
			stdio: 'inherit',
			env: { PATH: process.env.PATH, NODE_ENV: 'production' },
			timeout: 60000,
		},
	)
	if (child.error) throw child.error
	process.exit(child.status ?? 1)
}

const { SourceTextModule, SyntheticModule } = vm
const rootOption = process.argv.indexOf('--app-root')
const appRoot = path.resolve(
	rootOption < 0 ? '.' : process.argv[rootOption + 1],
)
const dist = path.join(appRoot, 'dist')
const modules = new Map()
const externalModules = new Map()
const sources = new Map()

async function discover(directory) {
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const filename = path.join(directory, entry.name)
		if (entry.isDirectory()) await discover(filename)
		else if (entry.name.endsWith('.js')) {
			const url = pathToFileURL(filename).href
			const source = await readFile(filename, 'utf8')
			sources.set(url, source)
			modules.set(
				url,
				new SourceTextModule(source, {
					identifier: url,
				}),
			)
		}
	}
}

function synthetic(exports, identifier) {
	return new SyntheticModule(
		Object.keys(exports),
		function () {
			for (const [name, value] of Object.entries(exports))
				this.setExport(name, value)
		},
		{ identifier },
	)
}

async function resolve(specifier, parent) {
	try {
		const url = import.meta.resolve(specifier, parent)
		if (url.startsWith('file:'))
			assert((await stat(fileURLToPath(url))).isFile())
		return url
	} catch (cause) {
		throw new Error(
			`${path.relative(appRoot, fileURLToPath(parent))}: cannot load ${specifier}. Preserve package exports; use explicit .js only for local imports.`,
			{ cause },
		)
	}
}

async function external(url) {
	if (!externalModules.has(url)) {
		externalModules.set(
			url,
			import(url).then((namespace) => synthetic(namespace, url)),
		)
	}
	return externalModules.get(url)
}

async function linker(specifier, parent) {
	const url = await resolve(specifier, parent.identifier)
	return modules.get(url) ?? external(url)
}

await discover(dist)
assert(
	modules.has(pathToFileURL(path.join(dist, 'index.js')).href),
	'Missing production entrypoint',
)
// Link every emitted module, including modules reached only by dynamic startup
// imports. Internal application code is never evaluated: no clients or workers start.
let dynamicImports = 0
for (const module of modules.values()) {
	if (module.status === 'unlinked') await module.link(linker)
	// Linking all files also checks modules entered dynamically, but does not
	// check the actual import() strings that point to them.
	for (const match of sources
		.get(module.identifier)
		.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1/gu)) {
		const url = await resolve(match[2], module.identifier)
		if (!modules.has(url)) await external(url)
		dynamicImports++
	}
}
console.log(`PASS literal dynamic imports: ${dynamicImports}`)
console.log(`PASS native ESM linkage: ${modules.size} compiled modules`)

// Exercise the emitted dashboard setup itself with real installed Koa/BullBoard.
// Only application configuration and queue I/O are substituted. Other app modules
// are not evaluated, and the HTTP server binds exclusively to loopback.
const boardUrl = pathToFileURL(
	path.join(dist, 'utils/api/koa/setup/bullBoard.js'),
).href
const board = new SourceTextModule(
	await readFile(fileURLToPath(boardUrl), 'utf8'),
	{ identifier: boardUrl },
)
const queues = new Map()
let reads = 0
await board.link(async (specifier, parent) => {
	const url = await resolve(specifier, parent.identifier)
	if (!modules.has(url)) return external(url)
	if (url.endsWith('/lib/startup/env.js')) {
		return synthetic(
			{
				default: {
					BULL_BOARD_USERNAME: 'runtime-check',
					BULL_BOARD_PASSWORD: 'runtime-check',
				},
			},
			url,
		)
	}
	assert(
		url.includes('/cache/queue/'),
		`Unexpected dashboard dependency: ${specifier}`,
	)
	const name = path.basename(fileURLToPath(url), '.js')
	const queue = {
		name,
		opts: {},
		metaValues: { version: 'bullmq:6' },
		async getJobCounts() {
			reads++
			return {
				waiting: 2,
				active: 1,
				completed: 3,
				failed: 0,
				delayed: 0,
				paused: 0,
				prioritized: 0,
				'waiting-children': 0,
			}
		},
		async isPaused() {
			return false
		},
		async getRateLimitTtl() {
			return 0
		},
		async getJobSchedulersCount() {
			return 0
		},
	}
	queues.set(name, queue)
	const exports = Object.fromEntries(
		Object.getOwnPropertyNames(modules.get(url).namespace).map((key) => [
			key,
			key.startsWith('get') ? () => ({ queue }) : { queue },
		]),
	)
	return synthetic(exports, url)
})
await board.evaluate()
const { default: Koa } = await import(await resolve('koa', boardUrl))
const app = new Koa()
board.namespace.setupBullBoard(app)
assert(queues.size > 0, 'Dashboard must register nonempty queues')
const server = createServer(app.callback())
try {
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
	const url = `http://127.0.0.1:${server.address().port}/api/pluto/admin/queues`
	assert.equal(
		(await fetch(`${url}/api/queues`)).status,
		401,
		'Dashboard must require authentication',
	)
	const headers = {
		Authorization: `Basic ${Buffer.from('runtime-check:runtime-check').toString('base64')}`,
	}
	const page = await fetch(url, { headers })
	assert.equal(page.status, 200, 'Dashboard HTML must render')
	assert(page.headers.get('content-type')?.includes('text/html'))
	assert.match(await page.text(), /<html[\s>]/iu)
	const response = await fetch(`${url}/api/queues`, { headers })
	const body = await response.text()
	assert.equal(response.status, 200, body.slice(0, 500))
	const result = JSON.parse(body)
	assert.deepEqual(
		result.queues.map((queue) => queue.name).sort(),
		[...queues.keys()].sort(),
	)
	assert(
		result.queues.every(
			(queue) => queue.counts.waiting === 2 && queue.counts.active === 1,
		),
	)
	assert(reads >= queues.size, 'Real adapters must read queue state')
	console.log(
		`PASS compiled dashboard startup: authentication and ${queues.size} queue summaries`,
	)
} finally {
	server.closeAllConnections()
	await new Promise((resolve) => server.close(resolve))
}
