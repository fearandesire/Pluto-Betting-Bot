import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error plain ESM script without type declarations
import { planEmojiSetup, runEmojiSetup, verifyAssets } from './lib.mjs'

const SOURCE = path.dirname(new URL(import.meta.url).pathname)
const MANIFEST = path.join(SOURCE, 'application-emoji-manifest.json')
const APP_ID = '999999999999999991'
const TOKEN = 'fake.token.value'

type Call = { method: string; path: string; body?: unknown }

function mockDiscord(opts: {
	existing?: string[]
	applicationId?: string
	failPostAt?: number
	rateLimits?: number
}) {
	const calls: Call[] = []
	const created: string[] = []
	let posts = 0
	let limited = 0
	const existing = [...(opts.existing ?? [])]
	const fetch = async (url: string, init: RequestInit = {}) => {
		const method = init.method ?? 'GET'
		const pathname = new URL(url).pathname
		const body = init.body ? JSON.parse(String(init.body)) : undefined
		calls.push({ method, path: pathname, body })
		expect((init.headers as Record<string, string>).Authorization).toBe(
			`Bot ${TOKEN}`,
		)
		if (pathname.endsWith('/applications/@me'))
			return Response.json({ id: opts.applicationId ?? APP_ID })
		if (method === 'GET')
			return Response.json({
				items: [...existing, ...created].map((name, i) => ({
					id: `88888888888888${String(i).padStart(4, '0')}`,
					name,
				})),
			})
		posts += 1
		if (opts.rateLimits && limited < opts.rateLimits) {
			limited += 1
			return Response.json({ retry_after: 0.5 }, { status: 429 })
		}
		if (opts.failPostAt === posts) {
			created.push(body.name)
			throw new TypeError('socket hang up')
		}
		created.push(body.name)
		return Response.json({
			id: `77777777777777${String(posts).padStart(4, '0')}`,
			name: body.name,
		})
	}
	return { fetch, calls, created }
}

const dirs: string[] = []
afterEach(async () => {
	for (const dir of dirs.splice(0))
		await fs.rm(dir, { recursive: true, force: true })
})

async function workDir() {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'badge-emoji-'))
	dirs.push(dir)
	return dir
}

/** A writable copy of the committed manifest and PNGs. */
async function copyAssets() {
	const dir = await workDir()
	await fs.cp(
		path.join(SOURCE, 'application-emoji'),
		path.join(dir, 'application-emoji'),
		{
			recursive: true,
		},
	)
	await fs.copyFile(MANIFEST, path.join(dir, 'manifest.json'))
	return dir
}

const manifestEntries = async () =>
	JSON.parse(await fs.readFile(MANIFEST, 'utf8')).entries as Array<{
		badge_key: string
		emoji_name: string
		sha256: string
	}>

async function run(
	discord: { fetch: unknown },
	argv: string[],
	over: {
		env?: Record<string, string>
		sleep?: (ms: number) => Promise<void>
	} = {},
) {
	const out: string[] = []
	const code = await runEmojiSetup({
		fetch: discord.fetch,
		env: over.env ?? { TOKEN },
		argv,
		log: (line: string) => out.push(line),
		sleep: over.sleep ?? (async () => undefined),
	})
	return { code, out: out.join('\n') }
}

describe('badge emoji setup', () => {
	it('makes only GET requests in dry-run', async () => {
		const discord = mockDiscord({})
		const { code, out } = await run(discord, [])
		expect(code).toBe(0)
		expect(discord.calls.every((c) => c.method === 'GET')).toBe(true)
		expect(out).toContain('"mode":"dry-run"')
	})

	it('plans create for every entry on an empty application', async () => {
		const { code, out } = await run(mockDiscord({}), [])
		expect(code).toBe(0)
		expect(JSON.parse(out.split('\n').at(-1) as string)).toMatchObject({
			total: 30,
			create: 30,
			exists: 0,
		})
	})

	it('plans nothing to create when every name exists', async () => {
		const names = (await manifestEntries()).map((e) => e.emoji_name)
		const { out } = await run(mockDiscord({ existing: names }), [])
		expect(JSON.parse(out.split('\n').at(-1) as string)).toMatchObject({
			create: 0,
			exists: 30,
		})
	})

	it('creates only the missing emoji and journals each id', async () => {
		const entries = await manifestEntries()
		const present = entries.slice(0, 28).map((e) => e.emoji_name)
		const discord = mockDiscord({ existing: present })
		const dir = await workDir()
		const journal = path.join(dir, 'journal.json')
		const { code } = await run(discord, [
			'--apply',
			'--application-id',
			APP_ID,
			'--journal',
			journal,
		])
		expect(code).toBe(0)
		const posts = discord.calls.filter((c) => c.method === 'POST')
		expect(posts.map((p) => (p.body as { name: string }).name)).toEqual(
			entries.slice(28).map((e) => e.emoji_name),
		)
		const written = JSON.parse(await fs.readFile(journal, 'utf8'))
		expect(written).toHaveLength(2)
		expect(written[0]).toMatchObject({
			badge_key: entries[28].badge_key,
			emoji_name: entries[28].emoji_name,
			application_id: APP_ID,
			sha256: entries[28].sha256,
		})
		expect(written[0].emoji_id).toMatch(/^\d{17,20}$/)
		const image = (posts[0].body as { image: string }).image
		expect(image.startsWith('data:image/png;base64,')).toBe(true)
		const png = Buffer.from(image.split(',')[1], 'base64')
		expect(createHash('sha256').update(png).digest('hex')).toBe(
			entries[28].sha256,
		)
	})

	it('never replaces an existing emoji with the same name', async () => {
		const entries = await manifestEntries()
		const discord = mockDiscord({ existing: [entries[0].emoji_name] })
		const dir = await workDir()
		await run(discord, [
			'--apply',
			'--application-id',
			APP_ID,
			'--journal',
			path.join(dir, 'j.json'),
		])
		const methods = new Set(discord.calls.map((c) => c.method))
		expect(methods).toEqual(new Set(['GET', 'POST']))
		expect(
			discord.calls.some(
				(c) =>
					c.method === 'POST' &&
					(c.body as { name: string }).name === entries[0].emoji_name,
			),
		).toBe(false)
	})

	it('aborts before any request when a PNG hash differs from the manifest', async () => {
		const dir = await copyAssets()
		const first = (await manifestEntries())[0]
		const file = path.join(
			dir,
			'application-emoji',
			`${first.emoji_name}.png`,
		)
		const bytes = await fs.readFile(file)
		bytes[bytes.length - 1] ^= 0xff
		await fs.writeFile(file, bytes)
		const discord = mockDiscord({})
		const { code, out } = await run(discord, [
			'--manifest',
			path.join(dir, 'manifest.json'),
		])
		expect(code).toBe(2)
		expect(out).toContain('differs from the manifest')
		expect(discord.calls).toHaveLength(0)
	})

	it('aborts before any request when a PNG is not 128 by 128', async () => {
		const dir = await copyAssets()
		const manifest = JSON.parse(
			await fs.readFile(path.join(dir, 'manifest.json'), 'utf8'),
		)
		const entry = manifest.entries[0]
		const file = path.join(dir, entry.png)
		const bytes = await fs.readFile(file)
		bytes.writeUInt32BE(64, 16)
		await fs.writeFile(file, bytes)
		entry.sha256 = createHash('sha256').update(bytes).digest('hex')
		await fs.writeFile(
			path.join(dir, 'manifest.json'),
			JSON.stringify(manifest),
		)
		const discord = mockDiscord({})
		const { code, out } = await run(discord, [
			'--manifest',
			path.join(dir, 'manifest.json'),
		])
		expect(code).toBe(2)
		expect(out).toContain('64x128')
		expect(discord.calls).toHaveLength(0)
	})

	it('refuses apply without an application id, and when the id does not match', async () => {
		const noId = mockDiscord({})
		expect((await run(noId, ['--apply'])).code).toBe(2)
		expect(noId.calls).toHaveLength(0)

		const wrong = mockDiscord({})
		const { code } = await run(wrong, [
			'--apply',
			'--application-id',
			'111111111111111111',
		])
		expect(code).toBe(2)
		expect(wrong.calls.every((c) => c.method === 'GET')).toBe(true)
	})

	it('waits for retry_after on 429 and then succeeds', async () => {
		const discord = mockDiscord({ rateLimits: 2 })
		const waits: number[] = []
		const dir = await workDir()
		const { code } = await run(
			discord,
			[
				'--apply',
				'--application-id',
				APP_ID,
				'--keys',
				'first_win',
				'--journal',
				path.join(dir, 'j.json'),
			],
			{ sleep: async (ms) => void waits.push(ms) },
		)
		expect(code).toBe(0)
		expect(waits).toEqual([500, 500])
		expect(discord.calls.filter((c) => c.method === 'POST')).toHaveLength(3)
	})

	it('stops on an uncertain failure and reconciles on the next run', async () => {
		const dir = await workDir()
		const journal = path.join(dir, 'j.json')
		const argv = [
			'--apply',
			'--application-id',
			APP_ID,
			'--keys',
			'first_win,ten_wins,fifty_wins',
			'--journal',
			journal,
		]
		const discord = mockDiscord({ failPostAt: 2 })
		const first = await run(discord, argv)
		expect(first.code).toBe(1)
		expect(first.out).toContain('outcome uncertain; run again to reconcile')
		expect(discord.calls.filter((c) => c.method === 'POST')).toHaveLength(2)
		expect(JSON.parse(await fs.readFile(journal, 'utf8'))).toHaveLength(1)

		// The second POST reached Discord before the socket died, so the next
		// inventory already lists it and only the third emoji is created.
		const second = await run(discord, argv)
		expect(second.code).toBe(0)
		expect(discord.created).toHaveLength(3)
		expect(new Set(discord.created).size).toBe(3)
	})

	it('never writes the token to output or the journal', async () => {
		const dir = await workDir()
		const journal = path.join(dir, 'j.json')
		const discord = mockDiscord({})
		const { out } = await run(discord, [
			'--apply',
			'--application-id',
			APP_ID,
			'--keys',
			'first_win',
			'--journal',
			journal,
		])
		expect(out).not.toContain(TOKEN)
		expect(await fs.readFile(journal, 'utf8')).not.toContain(TOKEN)
		const failing = await run(
			{
				fetch: async () => {
					throw new Error(`boom ${TOKEN}`)
				},
			},
			[],
		)
		expect(failing.out).not.toContain(TOKEN)
	})

	it('needs a token and a safe API base', async () => {
		const discord = mockDiscord({})
		expect((await run(discord, [], { env: {} })).code).toBe(2)
		expect(
			(await run(discord, ['--api-base', 'http://example.com'])).code,
		).toBe(2)
		expect(discord.calls).toHaveLength(0)
	})

	it('verifies the 30 committed PNGs against the committed manifest', async () => {
		const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'))
		const result = await verifyAssets(manifest, SOURCE)
		expect(result.errors).toEqual([])
		expect(result.assets.size).toBe(30)
	})

	it('plans by name only', () => {
		expect(
			planEmojiSetup(
				[
					{ badge_key: 'a', emoji_name: 'p_a' },
					{ badge_key: 'b', emoji_name: 'p_b' },
				],
				[{ name: 'p_a', id: '1' }],
			),
		).toEqual([
			{
				badge_key: 'a',
				emoji_name: 'p_a',
				action: 'exists',
				emoji_id: '1',
			},
			{ badge_key: 'b', emoji_name: 'p_b', action: 'create' },
		])
	})
})
