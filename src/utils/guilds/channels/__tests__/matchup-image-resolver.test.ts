import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { TEAM_REGISTRY } from '../image-team-aliases.js'
import { createMatchupImageResolver } from '../matchup-image-resolver.js'
import {
	validateImageBytes,
	validateMatchupManifest,
} from '../matchup-image-schema.js'
import {
	createFixtureAssets,
	writeFixtureManifest,
} from './matchup-image-fixtures.js'

let fixture: Awaited<ReturnType<typeof createFixtureAssets>>
const temporaryRoots: string[] = []
beforeAll(async () => {
	fixture = await createFixtureAssets()
	temporaryRoots.push(fixture.root)
})
afterAll(async () => {
	await Promise.all(
		temporaryRoots.map((root) =>
			fs.rm(root, { recursive: true, force: true }),
		),
	)
})
const request = { sport: 'nba', awayTeam: 'Clippers', homeTeam: 'Knicks' }
async function isolated() {
	const root = await fs.mkdtemp(
		path.join(os.tmpdir(), 'pluto-image-invalid-'),
	)
	temporaryRoots.push(root)
	await fs.cp(fixture.root, root, { recursive: true })
	return { root, manifest: structuredClone(fixture.manifest) }
}

describe('structured matchup image resolver', () => {
	it('resolves all 1,862 supported ordered combinations to the hash-bound approved file', async () => {
		const report = vi.fn()
		const resolver = createMatchupImageResolver({
			assetsRoot: fixture.root,
			report,
		})
		let count = 0
		for (const sport of ['nba', 'nfl'] as const)
			for (const away of TEAM_REGISTRY[sport])
				for (const home of TEAM_REGISTRY[sport]) {
					if (away.id === home.id) continue
					const bytes = await resolver({
						sport,
						awayTeam: away.name,
						homeTeam: home.name,
					})
					expect(bytes).not.toBeNull()
					const key = `${sport}:${[away.id, home.id].sort().join(':')}`
					const entry = fixture.manifest.entries.find(
						(item) => item.pairKey === key,
					)!
					expect(
						createHash('sha256').update(bytes!).digest('hex'),
					).toBe(entry.approval.sha256)
					count++
				}
		expect(count).toBe(1862)
		expect(
			new Set(fixture.manifest.entries.map((e) => e.sha256)).size,
		).toBe(931)
		expect(report).not.toHaveBeenCalled()
	}, 30000)
	it('supports Patriots, reverse Clippers–Knicks, legacy Washington, Portland and whitespace aliases', async () => {
		const resolver = createMatchupImageResolver({
			assetsRoot: fixture.root,
			report: vi.fn(),
		})
		for (const pair of [
			['nfl', 'New England Patriots', 'Washington Commanders'],
			['nfl', 'Patriots', 'Redskins'],
			['nfl', 'Patriots', 'Washington Football Team'],
			['nba', 'Clippers', 'Knicks'],
			['nba', 'Knicks', 'Clippers'],
			['nba', ' TrailBlazers ', 'Knicks'],
			[' NBA ', ' PORTLAND   TRAIL BLAZERS ', ' new york Knicks '],
		])
			expect(
				await resolver({
					sport: pair[0],
					awayTeam: pair[1],
					homeTeam: pair[2],
				}),
			).not.toBeNull()
		expect(
			await resolver({
				sport: 'nfl',
				awayTeam: 'Patriots',
				homeTeam: 'Redskins',
			}),
		).toEqual(
			await resolver({
				sport: 'nfl',
				awayTeam: 'Washington Commanders',
				homeTeam: 'New England Patriots',
			}),
		)
	})
	it('rejects unknown sport/team, cross-sport and self matchups; bounds logging without raw input', async () => {
		const report = vi.fn()
		const resolver = createMatchupImageResolver({
			assetsRoot: fixture.root,
			report,
		})
		for (let i = 0; i < 20; i++)
			for (const input of [
				{ ...request, sport: 'mlb' },
				{ ...request, awayTeam: 'private-untrusted-input' },
				{ ...request, awayTeam: 'Patriots' },
				{ ...request, awayTeam: 'Knicks' },
			])
				expect(await resolver(input)).toBeNull()
		expect(report.mock.calls.map(([item]) => item.reason)).toEqual([
			'unknown_sport',
			'unknown_team',
			'self_matchup',
		])
		expect(JSON.stringify(report.mock.calls)).not.toContain(
			'private-untrusted-input',
		)
	})
	it('loads the manifest once and reads current asset bytes each request', async () => {
		const { root, manifest } = await isolated()
		const resolver = createMatchupImageResolver({
			assetsRoot: root,
			report: vi.fn(),
		})
		expect(await resolver(request)).not.toBeNull()
		await fs.writeFile(path.join(root, 'manifest.json'), 'broken')
		expect(await resolver(request)).not.toBeNull()
		const entry = manifest.entries.find(
			(item) => item.pairKey === 'nba:clippers:knicks',
		)!
		await fs.writeFile(path.join(root, entry.path), 'changed')
		expect(await resolver(request)).toBeNull()
	})
	for (const issue of [
		'missing',
		'json',
		'revision',
		'coverage',
		'approval',
		'placeholder',
		'directional',
		'release',
		'traversal',
		'absolute',
	] as const) {
		it(`safely rejects ${issue} manifest and visibly reports startup failure`, async () => {
			const { root, manifest } = await isolated()
			if (issue === 'missing')
				await fs.unlink(path.join(root, 'manifest.json'))
			else if (issue === 'json')
				await fs.writeFile(path.join(root, 'manifest.json'), '{')
			else {
				if (issue === 'revision')
					(manifest as any).teamsRevision = '0'.repeat(64)
				if (issue === 'coverage')
					manifest.entries[1] = structuredClone(manifest.entries[0])
				if (issue === 'approval')
					manifest.entries[0].approval.sha256 = '0'.repeat(64)
				if (issue === 'placeholder')
					manifest.entries[0].approval.evidence = 'pending-review'
				if (issue === 'directional')
					(manifest.entries[0] as any).orderIndependent = false
				if (issue === 'traversal')
					manifest.entries[0].path = 'nba/../outside.jpg'
				if (issue === 'absolute')
					manifest.entries[0].path = '/outside.jpg'
				await writeFixtureManifest(root, manifest)
				if (issue === 'release') {
					manifest.releaseId = '0'.repeat(64)
					await fs.writeFile(
						path.join(root, 'manifest.json'),
						JSON.stringify(manifest),
					)
				}
			}
			const report = vi.fn()
			const resolver = createMatchupImageResolver({
				assetsRoot: root,
				report,
			})
			for (let i = 0; i < 3; i++)
				expect(await resolver(request)).toBeNull()
			expect(report).toHaveBeenCalledTimes(1)
			expect(report.mock.calls[0][0].event).toBe(
				'matchup.image.unavailable',
			)
		})
	}
	for (const issue of [
		'missing',
		'hash',
		'signature',
		'dimensions',
		'truncated',
	] as const) {
		it(`returns null for ${issue} asset`, async () => {
			const { root, manifest } = await isolated()
			const entry = manifest.entries.find(
				(item) => item.pairKey === 'nba:clippers:knicks',
			)!
			const file = path.join(root, entry.path)
			if (issue === 'missing') await fs.unlink(file)
			else if (issue === 'dimensions') {
				entry.width = 100
				await writeFixtureManifest(root, manifest)
			} else {
				const bytes =
					issue === 'truncated'
						? (await fs.readFile(file)).subarray(0, 32)
						: Buffer.from('wrong image bytes')
				await fs.writeFile(file, bytes)
				if (issue !== 'hash') {
					entry.sha256 = createHash('sha256')
						.update(bytes)
						.digest('hex')
					entry.approval.sha256 = entry.sha256
					await writeFixtureManifest(root, manifest)
				}
			}
			const report = vi.fn()
			expect(
				await createMatchupImageResolver({ assetsRoot: root, report })(
					request,
				),
			).toBeNull()
			expect(report.mock.calls[0][0].reason).toBe(
				issue === 'missing'
					? 'asset_unavailable'
					: issue === 'hash'
						? 'asset_hash'
						: 'asset_signature',
			)
		})
	}
	for (const kind of ['root', 'manifest', 'directory', 'image'] as const) {
		it(`rejects ${kind} symlinks`, async () => {
			const { root, manifest } = await isolated()
			const entry = manifest.entries.find(
				(item) => item.pairKey === 'nba:clippers:knicks',
			)!
			let assetsRoot = root
			if (kind === 'root') {
				assetsRoot = `${root}-link`
				temporaryRoots.push(assetsRoot)
				await fs.symlink(root, assetsRoot)
			} else {
				const relative =
					kind === 'manifest'
						? 'manifest.json'
						: kind === 'directory'
							? 'nba'
							: entry.path
				await fs.rm(path.join(root, relative), { recursive: true })
				await fs.symlink(
					path.join(fixture.root, relative),
					path.join(root, relative),
				)
			}
			const report = vi.fn()
			expect(
				await createMatchupImageResolver({ assetsRoot, report })(
					request,
				),
			).toBeNull()
			expect(report.mock.calls[0][0].reason).toBe('unsafe_path')
		})
	}

	it('reports a missing manifest at initialization even without a matchup request', async () => {
		const report = vi.fn()
		createMatchupImageResolver({
			assetsRoot: path.join(fixture.root, 'absent'),
			report,
		})
		await vi.waitFor(() =>
			expect(report).toHaveBeenCalledWith({
				component: 'matchup-images',
				event: 'matchup.image.unavailable',
				reason: 'manifest_unavailable',
			}),
		)
	})
	it('rejects a symlink in an ancestor of the assets root', async () => {
		const link = `${fixture.root}-parent-link`
		temporaryRoots.push(link)
		await fs.symlink(path.dirname(fixture.root), link)
		const report = vi.fn()
		const resolver = createMatchupImageResolver({
			assetsRoot: path.join(link, path.basename(fixture.root)),
			report,
		})
		expect(await resolver(request)).toBeNull()
		expect(report.mock.calls[0][0].reason).toBe('unsafe_path')
	})
	it('signature validation handles malformed JPEG marker streams without throwing', () => {
		const bytes = Buffer.from([
			0xff, 0xd8, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
			0xd9,
		])
		expect(
			validateImageBytes(bytes, {
				mime: 'image/jpeg',
				width: 1280,
				height: 720,
			}),
		).toBe(false)
	})
	it('schema exports validate complete coverage and content identity', () => {
		expect(validateMatchupManifest(fixture.manifest).entries).toHaveLength(
			931,
		)
	})
	it('compiled module resolves from another CWD without starting the bot', async () => {
		const workspace = await fs.mkdtemp(
			path.join(os.tmpdir(), 'pluto-image-compiled-'),
		)
		temporaryRoots.push(workspace)
		const sourceDir = path.resolve('src/utils/guilds/channels')
		const outputDir = path.join(workspace, 'dist/utils/guilds/channels')
		await fs.mkdir(outputDir, { recursive: true })
		await fs.writeFile(
			path.join(workspace, 'package.json'),
			'{"type":"module"}',
		)
		await fs.symlink(
			path.resolve('node_modules'),
			path.join(workspace, 'node_modules'),
		)
		await fs.mkdir(path.join(workspace, 'assets'))
		await fs.cp(
			fixture.root,
			path.join(workspace, 'assets/matchupimages'),
			{ recursive: true },
		)
		const { transform } = await import('@swc/core')
		for (const name of [
			'image-team-data',
			'image-team-aliases',
			'matchup-image-schema',
			'matchup-image-resolver',
		]) {
			const { code } = await transform(
				await fs.readFile(path.join(sourceDir, `${name}.ts`), 'utf8'),
				{
					filename: `${name}.ts`,
					jsc: { parser: { syntax: 'typescript' }, target: 'es2021' },
					module: { type: 'es6' },
				},
			)
			await fs.writeFile(path.join(outputDir, `${name}.js`), code)
		}
		const result = spawnSync(
			process.execPath,
			[
				'--input-type=module',
				'-e',
				`import {resolveMatchupImage} from ${JSON.stringify(`file://${outputDir}/matchup-image-resolver.js`)}; const result=await resolveMatchupImage(${JSON.stringify(request)}); if (!Buffer.isBuffer(result)) process.exit(1); console.log(JSON.stringify({bytes:result.length,cwd:process.cwd()}));`,
			],
			{ cwd: os.tmpdir(), encoding: 'utf8', timeout: 10000 },
		)
		expect(result.status, result.stderr).toBe(0)
		expect(JSON.parse(result.stdout).bytes).toBeGreaterThan(0)
		expect(JSON.parse(result.stdout).cwd).toBe(os.tmpdir())
	})
})
