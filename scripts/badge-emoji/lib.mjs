import { createHash } from 'node:crypto'
import nodeFs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_API_BASE = 'https://discord.com/api/v10'
const DEFAULT_MANIFEST = path.join(HERE, 'application-emoji-manifest.json')
const PNG_SIGNATURE = Buffer.from([
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
])
const EMOJI_NAME = /^[a-z0-9_]{2,32}$/
const SNOWFLAKE = /^\d{17,20}$/
const MAX_BYTES = 256 * 1024
const EMOJI_SIZE = 128
const MAX_RETRIES = 5
const UNCERTAIN = 'outcome uncertain; run again to reconcile'

export const EXIT_OK = 0
export const EXIT_FAILED = 1
export const EXIT_USAGE = 2

class UsageError extends Error {}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')

function pngSize(buffer) {
	if (buffer.length < 24 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE))
		return null
	return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
}

export async function verifyAssets(manifest, manifestDir, fs = nodeFs) {
	const errors = []
	const assets = new Map()
	const names = new Set()
	const keys = new Set()
	for (const entry of manifest.entries ?? []) {
		const id = entry.badge_key
		if (keys.has(id)) errors.push(`${id}: duplicate badge_key`)
		keys.add(id)
		if (!EMOJI_NAME.test(entry.emoji_name ?? ''))
			errors.push(
				`${id}: emoji_name "${entry.emoji_name}" is not [a-z0-9_]{2,32}`,
			)
		if (names.has(entry.emoji_name))
			errors.push(`${id}: duplicate emoji_name "${entry.emoji_name}"`)
		names.add(entry.emoji_name)

		let bytes
		try {
			bytes = await fs.readFile(path.join(manifestDir, entry.png))
		} catch {
			errors.push(`${id}: file ${entry.png} is missing`)
			continue
		}
		const digest = sha256(bytes)
		if (digest !== entry.sha256)
			errors.push(`${id}: sha256 ${digest} differs from the manifest`)
		if (bytes.length > MAX_BYTES)
			errors.push(`${id}: ${bytes.length} bytes exceeds ${MAX_BYTES}`)
		const size = pngSize(bytes)
		if (!size) errors.push(`${id}: not a PNG`)
		else if (size.width !== EMOJI_SIZE || size.height !== EMOJI_SIZE)
			errors.push(
				`${id}: ${size.width}x${size.height}, expected ${EMOJI_SIZE}x${EMOJI_SIZE}`,
			)
		assets.set(id, { bytes, sha256: digest })
	}
	return { ok: errors.length === 0, errors, assets }
}

/** An emoji whose name already exists is never replaced. */
export function planEmojiSetup(entries, existing) {
	const idByName = new Map(existing.map((emoji) => [emoji.name, emoji.id]))
	return entries.map((entry) => {
		const emojiId = idByName.get(entry.emoji_name)
		return emojiId
			? {
					badge_key: entry.badge_key,
					emoji_name: entry.emoji_name,
					action: 'exists',
					emoji_id: emojiId,
				}
			: {
					badge_key: entry.badge_key,
					emoji_name: entry.emoji_name,
					action: 'create',
				}
	})
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function parseCli(argv) {
	try {
		const { values } = parseArgs({
			args: argv,
			options: {
				apply: { type: 'boolean', default: false },
				'application-id': { type: 'string' },
				manifest: { type: 'string' },
				journal: { type: 'string' },
				keys: { type: 'string' },
				'api-base': { type: 'string' },
			},
			strict: true,
		})
		return values
	} catch (error) {
		throw new UsageError(error.message)
	}
}

function checkApiBase(value) {
	let url
	try {
		url = new URL(value)
	} catch {
		throw new UsageError('--api-base is not a valid URL')
	}
	const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
	if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local))
		throw new UsageError('--api-base must be https, or http on localhost')
	return value.replace(/\/+$/, '')
}

async function atomicAppend(fs, file, record) {
	let journal = []
	try {
		journal = JSON.parse(await fs.readFile(file, 'utf8'))
	} catch {
		journal = []
	}
	journal.push(record)
	const tmp = `${file}.tmp`
	await fs.writeFile(tmp, `${JSON.stringify(journal, null, '\t')}\n`)
	await fs.rename(tmp, file)
}

/** Dry-run unless `--apply`, which also needs `--application-id` as confirmation. Returns an exit code. */
export async function runEmojiSetup({
	fetch,
	env,
	argv,
	fs = nodeFs,
	log = console.log,
	sleep = defaultSleep,
}) {
	const token = env.TOKEN ?? ''
	const say = (message) =>
		log(token ? String(message).replaceAll(token, '[redacted]') : message)
	try {
		const options = parseCli(argv)
		const apiBase = checkApiBase(options['api-base'] ?? DEFAULT_API_BASE)
		const manifestPath = options.manifest ?? DEFAULT_MANIFEST
		const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))

		const verification = await verifyAssets(
			manifest,
			path.dirname(manifestPath),
			fs,
		)
		if (!verification.ok) {
			for (const error of verification.errors)
				say(`asset check failed: ${error}`)
			return EXIT_USAGE
		}

		let entries = manifest.entries
		if (options.keys) {
			const wanted = options.keys.split(',').map((key) => key.trim())
			const unknown = wanted.filter(
				(key) => !entries.some((e) => e.badge_key === key),
			)
			if (unknown.length)
				throw new UsageError(
					`unknown badge keys: ${unknown.join(', ')}`,
				)
			entries = entries.filter((entry) =>
				wanted.includes(entry.badge_key),
			)
		}
		if (options.apply && !options['application-id'])
			throw new UsageError('--apply requires --application-id')
		if (!token) throw new UsageError('TOKEN is not set')

		const headers = {
			Authorization: `Bot ${token}`,
			'Content-Type': 'application/json',
			'User-Agent':
				'DiscordBot (https://github.com/fearandesire/Pluto-Betting-Bot, 1.0)',
		}

		const application = await getJson(
			fetch,
			`${apiBase}/applications/@me`,
			headers,
		)
		const applicationId = String(application.id ?? '')
		if (!SNOWFLAKE.test(applicationId))
			throw new Error('could not resolve the application id')
		if (options.apply && options['application-id'] !== applicationId)
			throw new UsageError(
				'--application-id does not match the application this token belongs to',
			)

		const inventory = await getJson(
			fetch,
			`${apiBase}/applications/${applicationId}/emojis`,
			headers,
		)
		const existing = Array.isArray(inventory)
			? inventory
			: (inventory.items ?? [])
		const plan = planEmojiSetup(entries, existing)

		for (const step of plan)
			say(
				`${step.action === 'exists' ? 'exists ' : 'create '} ${step.emoji_name} (${step.badge_key})${step.emoji_id ? ` id ${step.emoji_id}` : ''}`,
			)
		const toCreate = plan.filter((step) => step.action === 'create')
		const summary = {
			mode: options.apply ? 'apply' : 'dry-run',
			application_id: applicationId,
			total: plan.length,
			exists: plan.length - toCreate.length,
			create: toCreate.length,
			created: 0,
		}

		if (options.apply) {
			const journalPath =
				options.journal ??
				path.join(HERE, `journal.${applicationId}.json`)
			const byKey = new Map(
				entries.map((entry) => [entry.badge_key, entry]),
			)
			for (const step of toCreate) {
				const asset = verification.assets.get(step.badge_key)
				let created
				try {
					created = await postJson(
						fetch,
						`${apiBase}/applications/${applicationId}/emojis`,
						headers,
						{
							name: step.emoji_name,
							image: `data:image/png;base64,${asset.bytes.toString('base64')}`,
						},
						sleep,
					)
				} catch (error) {
					say(
						`stopped at ${step.emoji_name}: ${error.message}. ${error.rateLimited ? 'Run again to continue.' : UNCERTAIN}`,
					)
					say(JSON.stringify(summary))
					return EXIT_FAILED
				}
				if (!SNOWFLAKE.test(String(created.id ?? ''))) {
					say(
						`stopped at ${step.emoji_name}: response had no emoji id. ${UNCERTAIN}`,
					)
					say(JSON.stringify(summary))
					return EXIT_FAILED
				}
				await atomicAppend(fs, journalPath, {
					badge_key: step.badge_key,
					emoji_name: step.emoji_name,
					emoji_id: created.id,
					application_id: applicationId,
					sha256: byKey.get(step.badge_key).sha256,
					created_at: new Date().toISOString(),
				})
				summary.created += 1
				say(`created ${step.emoji_name} id ${created.id}`)
			}
		}
		say(JSON.stringify(summary))
		return EXIT_OK
	} catch (error) {
		say(error.message)
		return error instanceof UsageError ? EXIT_USAGE : EXIT_FAILED
	}
}

async function getJson(fetch, url, headers) {
	const response = await fetch(url, { method: 'GET', headers })
	if (!response.ok)
		throw new Error(
			`GET ${new URL(url).pathname} failed (${response.status})`,
		)
	return await response.json()
}

async function postJson(fetch, url, headers, body, sleep) {
	for (let attempt = 0; ; attempt += 1) {
		const response = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
		})
		if (response.status === 429) {
			if (attempt >= MAX_RETRIES) {
				const error = new Error(
					`rate limit not cleared after ${MAX_RETRIES} retries`,
				)
				error.rateLimited = true
				throw error
			}
			const payload = await response.json().catch(() => ({}))
			const seconds = Number(
				payload.retry_after ??
					response.headers?.get?.('retry-after') ??
					1,
			)
			await sleep(Math.max(0, seconds) * 1000)
			continue
		}
		if (!response.ok)
			throw new Error(
				`POST ${new URL(url).pathname} failed (${response.status})`,
			)
		return await response.json()
	}
}
