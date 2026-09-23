/**
 * Dumps every migration surface to discord-preview JSON.
 *   CV2_DUMP=before|after CV2_CLUSTER=<cluster|all> pnpm vitest run scripts/cv2/dump-surfaces.test.ts
 * Then: scripts/cv2/render.sh <cluster|all>
 * Skipped unless CV2_DUMP is set, so it never runs in CI.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'dotenv'
import { afterAll, beforeAll, describe, it, vi } from 'vitest'
import {
	type ClusterFixtures,
	type DumpMessage,
	FIXED,
	IMAGE_CACHE,
} from './fixtures/types.js'

const phase = process.env.CV2_DUMP as 'before' | 'after' | undefined
const only = process.env.CV2_CLUSTER ?? 'all'
const SCREENS = path.resolve(__dirname, '../../docs/components-v2/screens')

// Local-time strings follow the process TZ. Production sets none (UTC), so
// render in UTC to show what users actually see.
process.env.TZ = 'UTC'

// App modules validate env at import time; .env.example has safe placeholders.
if (phase) {
	const example = parse(
		readFileSync(path.resolve(__dirname, '../../.env.example')),
	)
	for (const [k, v] of Object.entries(example)) process.env[k] ??= v
}

// Each fixtures/cluster-*.ts exports `default: ClusterFixtures`. Loaded only
// when dumping, after env is populated.
const FIXTURES = path.resolve(__dirname, 'fixtures')
const clusterModules: { default: ClusterFixtures }[] = phase
	? await Promise.all(
			readdirSync(FIXTURES)
				.filter((f) => /^cluster-.+\.ts$/.test(f))
				.sort()
				.map((f) => import(path.join(FIXTURES, f))),
		)
	: []

const IMAGE_KEYS = new Set(['url', 'icon_url', 'proxy_url'])

function inlineImage(url: string): string {
	const file = IMAGE_CACHE[url]
	if (!file) {
		throw new Error(
			`Remote image ${url} has no local copy: add it to IMAGE_CACHE in scripts/cv2/fixtures/types.ts`,
		)
	}
	const data = readFileSync(path.resolve(__dirname, 'fixtures/images', file))
	return `data:image/png;base64,${data.toString('base64')}`
}

/** Builders → plain JSON; remote image URLs → cached data URLs. */
const serialize = (value: unknown): unknown =>
	JSON.parse(
		JSON.stringify(value, (k, v) => {
			if (v && typeof v === 'object' && typeof v.toJSON === 'function')
				return v.toJSON()
			if (
				IMAGE_KEYS.has(k) &&
				typeof v === 'string' &&
				/^https?:\/\/.+\.(png|jpe?g|gif|webp)(\?.*)?$/i.test(v)
			)
				return inlineImage(v)
			return v
		}),
	)

function toPreview(msg: DumpMessage) {
	return {
		author: { name: 'Pluto', bot: true },
		...(serialize(msg) as object),
	}
}

describe.skipIf(!phase)(`cv2 dump (${phase ?? 'off'})`, () => {
	beforeAll(() => {
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(FIXED.now)
		// Rotating footers / random picks render the same every run.
		vi.spyOn(Math, 'random').mockReturnValue(0)
	})
	afterAll(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
	})

	const clusters = clusterModules
		.map((m) => m.default)
		.filter((c) => only === 'all' || c.cluster === only)

	for (const { cluster, surfaces } of clusters) {
		for (const s of surfaces) {
			const build = phase ? s[phase] : undefined
			it.skipIf(!build)(`${cluster}/${s.id} ${s.name}`, async () => {
				const dir = path.join(SCREENS, cluster)
				mkdirSync(dir, { recursive: true })
				const msg = await build!()
				writeFileSync(
					path.join(dir, `${s.id}-${phase}.json`),
					`${JSON.stringify(toPreview(msg), null, '\t')}\n`,
				)
			})
		}
	}
})
