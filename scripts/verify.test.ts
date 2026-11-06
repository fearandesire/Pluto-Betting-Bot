import { execFileSync, spawn, spawnSync } from 'node:child_process'
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { afterEach, describe, expect, it } from 'vitest'

const fixtures: string[] = []
const external = {
	name: 'Live financial flows',
	required: false,
	reason: 'Unauthorized',
}
const step = (code: string, extra = {}) => ({
	name: 'Fixture driver',
	command: [process.execPath, '-e', code],
	...extra,
})
const receipt = `require('node:fs').writeFileSync(process.env.VERIFY_RECEIPT_PATH, JSON.stringify({status:'passed',source:JSON.parse(process.env.VERIFY_SOURCE_JSON)}))`

function fixture(steps = [step('')], skipped = [external]) {
	const root = mkdtempSync(path.join(tmpdir(), 'pluto-verify-'))
	fixtures.push(root)
	mkdirSync(path.join(root, 'scripts/verification'), { recursive: true })
	copyFileSync(
		new URL('./verify.mjs', import.meta.url),
		path.join(root, 'scripts/verify.mjs'),
	)
	writeFileSync(
		path.join(root, 'scripts/verification/config.json'),
		JSON.stringify({ project: 'Fixture', steps, skipped }),
	)
	writeFileSync(path.join(root, '.gitignore'), '.verification/\n')
	writeFileSync(path.join(root, 'source.txt'), 'original')
	const git = (args: string[]) =>
		execFileSync('git', args, { cwd: root, stdio: 'pipe' })
	git(['init', '-q'])
	git(['add', '.'])
	git([
		'-c',
		'user.name=Verification fixture',
		'-c',
		'user.email=fixture@example.invalid',
		'commit',
		'-qm',
		'fixture',
	])
	return root
}
function manifest(root: string) {
	const [run] = readdirSync(path.join(root, '.verification'))
	return JSON.parse(
		readFileSync(
			path.join(root, '.verification', run, 'manifest.json'),
			'utf8',
		),
	)
}
function run(root: string) {
	const result = spawnSync(process.execPath, ['scripts/verify.mjs'], {
		cwd: root,
		env: { PATH: process.env.PATH, VERIFY_SEED: '1234' },
		encoding: 'utf8',
		timeout: 15000,
	})
	expect(result.error).toBeUndefined()
	return { result, evidence: manifest(root) }
}

afterEach(() => {
	for (const root of fixtures.splice(0))
		rmSync(root, { recursive: true, force: true })
})

describe('verification evidence contract', () => {
	it('retains clean source, logs, driver receipt and explicit optional skips', () => {
		const root = fixture([step(receipt, { receipt: 'dashboard.json' })])
		const { result, evidence } = run(root)
		expect(result.status).toBe(0)
		expect(evidence).toMatchObject({
			status: 'passed',
			cleanup: true,
			sourceUnchanged: true,
			propertySeed: 1234,
			source: { dirty: false },
			skipped: [external],
		})
		expect(evidence.checks[0]).toMatchObject({
			status: 'passed',
			receipt: 'dashboard.json',
			log: '1.log',
		})
		const directory = path.join(root, '.verification', evidence.run)
		expect(existsSync(path.join(directory, '1.log'))).toBe(true)
		expect(
			JSON.parse(
				readFileSync(path.join(directory, 'dashboard.json'), 'utf8'),
			).source,
		).toEqual(evidence.source)
	})
	it('fails when a required journey is skipped', () => {
		const { result, evidence } = run(
			fixture([step('')], [{ ...external, required: true }]),
		)
		expect(result.status).toBe(1)
		expect(evidence).toMatchObject({
			status: 'failed',
			cleanup: true,
			reason: 'A required journey was skipped',
		})
	})
	it('fails missing drivers and skips subsequent checks', () => {
		const root = fixture([
			{
				name: 'Missing driver',
				command: [path.join(tmpdir(), 'pluto-nonexistent-driver')],
			},
			step(''),
		])
		const { result, evidence } = run(root)
		expect(result.status).toBe(1)
		expect(
			evidence.checks.map((check: { status: string }) => check.status),
		).toEqual(['failed', 'skipped'])
		expect(evidence.cleanup).toBe(true)
	})
	it.each([
		['absent', ''],
		[
			'stale',
			receipt.replace('JSON.parse(process.env.VERIFY_SOURCE_JSON)', '{}'),
		],
		['failed', receipt.replace("status:'passed'", "status:'failed'")],
	])(
		'rejects a %s receipt even when the driver exits zero',
		(_name, code) => {
			const { result, evidence } = run(
				fixture([step(code, { receipt: 'dashboard.json' })]),
			)
			expect(result.status).toBe(1)
			expect(evidence.checks[0].status).toBe('failed')
		},
	)
	it.each(['source.txt', 'new-source.txt'])(
		'rejects changing tracked or untracked source: %s',
		(file) => {
			const { result, evidence } = run(
				fixture([
					step(
						`require('node:fs').writeFileSync(${JSON.stringify(file)}, 'changed')`,
					),
				]),
			)
			expect(result.status).toBe(1)
			expect(evidence).toMatchObject({
				status: 'failed',
				sourceUnchanged: false,
			})
		},
	)
	it('fails timed-out commands and retains their logs', () => {
		const { result, evidence } = run(
			fixture([step('setInterval(() => {}, 1000)', { timeoutMs: 100 })]),
		)
		expect(result.status).toBe(1)
		expect(evidence.checks[0]).toMatchObject({
			status: 'failed',
			reason: 'Command exceeded timeout',
		})
		expect(evidence.cleanup).toBe(true)
	})
	it.skipIf(process.platform === 'win32')(
		'bounds interruption of a child that ignores SIGTERM',
		async () => {
			const root = fixture([
				step(
					`process.on('SIGTERM', () => {}); require('node:fs').writeFileSync('ready', String(process.pid)); setInterval(() => {}, 1000)`,
				),
				step(''),
			])
			const child = spawn(process.execPath, ['scripts/verify.mjs'], {
				cwd: root,
				stdio: 'ignore',
			})
			const closed = new Promise((resolve) =>
				child.once('close', resolve),
			)
			try {
				for (
					let tries = 0;
					tries < 200 && !existsSync(path.join(root, 'ready'));
					tries++
				)
					await delay(10)
				expect(existsSync(path.join(root, 'ready'))).toBe(true)
				const pid = Number(
					readFileSync(path.join(root, 'ready'), 'utf8'),
				)
				child.kill('SIGTERM')
				expect(await closed).toBe(1)
				expect(() => process.kill(pid, 0)).toThrow()
				const evidence = manifest(root)
				expect(evidence.checks[0]).toMatchObject({
					status: 'failed',
					reason: 'SIGTERM',
				})
				expect(evidence.checks[1].status).toBe('skipped')
				expect(evidence.cleanup).toBe(true)
			} finally {
				child.kill('SIGKILL')
			}
		},
		12000,
	)
})
