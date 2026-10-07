import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
	createFixtureAssets,
	writeFixtureManifest,
} from '../src/utils/guilds/channels/__tests__/matchup-image-fixtures.js'
import * as schema from '../src/utils/guilds/channels/matchup-image-schema.js'
import { validateAssets } from './validate-matchup-assets.mjs'

const roots: string[] = []
async function fixture() {
	const fixture = await createFixtureAssets()
	const assets = await fs.mkdtemp(
		path.join(os.tmpdir(), 'pluto-validator-test-'),
	)
	roots.push(assets)
	await fs.rename(fixture.root, path.join(assets, 'matchupimages'))
	return { ...fixture, root: path.join(assets, 'matchupimages'), assets }
}
const options = { schema, fixture: true }
afterEach(async () => {
	for (const root of roots.splice(0))
		await fs.rm(root, { recursive: true, force: true })
})
describe('full asset decoding and coverage gate (synthetic identity fixtures)', () => {
	it('accepts all 931 pairs and legacy PNG bytes under jpg names', async () => {
		const f = await fixture()
		expect((await validateAssets(f.assets, options)).pairs).toBe(931)
		expect((await validateAssets(f.assets, options)).orderedLookups).toBe(
			1862,
		)
		expect(
			f.manifest.entries.some(
				(e) => e.path.endsWith('.jpg') && e.mime === 'image/png',
			),
		).toBe(true)
	}, 30000)
	it.each([
		'missing',
		'digest',
		'symlink',
		'corrupt',
		'mime',
		'approval',
		'coverage',
		'self',
		'unknown',
		'duplicate',
		'traversal',
		'release',
	] as const)('rejects %s', async (kind) => {
		const f = await fixture(),
			e = f.manifest.entries[0],
			file = path.join(f.root, e.path)
		if (kind === 'missing') await fs.unlink(file)
		if (kind === 'digest') await fs.writeFile(file, 'tampered')
		if (kind === 'symlink') {
			await fs.unlink(file)
			await fs.symlink('/etc/passwd', file)
		}
		if (kind === 'corrupt') {
			const bytes = Buffer.from('not an image')
			await fs.writeFile(file, bytes)
			e.sha256 = createHash('sha256').update(bytes).digest('hex')
			e.approval.sha256 = e.sha256
		}
		if (kind === 'mime')
			e.mime = e.mime === 'image/png' ? 'image/jpeg' : 'image/png'
		if (kind === 'approval') e.approval.teams = ['wrong', e.teams[1]]
		if (kind === 'coverage') f.manifest.entries.pop()
		if (kind === 'self') e.teams = [e.teams[0], e.teams[0]]
		if (kind === 'unknown') e.teams = ['invented', e.teams[1]]
		if (kind === 'duplicate') f.manifest.entries[1] = e
		if (kind === 'traversal') e.path = '../escape.jpg'
		await writeFixtureManifest(f.root, f.manifest)
		if (kind === 'release') {
			f.manifest.releaseId = '0'.repeat(64)
			await fs.writeFile(
				path.join(f.root, 'manifest.json'),
				JSON.stringify(f.manifest),
			)
		}
		await expect(validateAssets(f.assets, options)).rejects.toThrow()
	})
	it('requires a hash-bound observed-team receipt and refuses synthetic approvals for real releases', async () => {
		const f = await fixture()
		await expect(validateAssets(f.assets, { schema })).rejects.toThrow(
			'approval_receipt_mismatch',
		)
		await fs.writeFile(
			path.join(f.root, 'visual-review/receipt.json'),
			JSON.stringify({ kind: 'test-fixture', entries: [] }),
		)
		await expect(validateAssets(f.assets, options)).rejects.toThrow(
			'approval_receipt_mismatch',
		)
	})
})

// Complete credential-free real-gate fixture: approvals are explicit test stubs,
// never evidence of production artwork quality. All real-gate branches execute.
async function releaseFixture() {
	const fixture = await createFixtureAssets({ width: 400, height: 400 })
	const assets = await fs.mkdtemp(
		path.join(os.tmpdir(), 'pluto-release-fixture-'),
	)
	roots.push(assets)
	const root = path.join(assets, 'matchupimages')
	await fs.rename(fixture.root, root)
	const m = fixture.manifest,
		missing = m.entries.find((e) => e.pairKey === 'nfl:bears:commanders')!
	await fs.rename(
		path.join(root, missing.path),
		path.join(root, 'nfl/Bears_vs_Commanders.jpg'),
	)
	missing.path = 'nfl/Bears_vs_Commanders.jpg'
	const newEntries = [
			missing,
			...m.entries.filter((e) => e !== missing).slice(0, 101),
		],
		newKeys = new Set(newEntries.map((e) => e.pairKey))
	const reuseEntries = m.entries
			.filter((e) => !newKeys.has(e.pairKey))
			.slice(0, 12),
		reuseKeys = new Set(reuseEntries.map((e) => e.pairKey))
	const baseline: any[] = [],
		rows: any[] = [],
		changes: any[] = []
	const sources = newEntries.map((e) => ({
		pairKey: e.pairKey,
		status: 'recovered',
		sha256: e.sha256,
		teams: e.teams,
		imageUrl: `https://fixture.invalid/${e.pairKey}`,
		competitors: e.teams.map((canonicalId) => ({ canonicalId })),
	}))
	let counter = 0
	const add = async (
		entry: any,
		relative: string,
		action?: string,
		oldPath?: string,
	) => {
		const bytes = await fs.readFile(path.join(root, entry.path))
		await fs.mkdir(path.dirname(path.join(root, relative)), {
			recursive: true,
		})
		if (relative !== entry.path)
			await fs.writeFile(path.join(root, relative), bytes)
		const id = `S${counter++}`,
			originalPath = oldPath ?? relative,
			originalHash = action
				? createHash('sha256').update(`old:${id}`).digest('hex')
				: entry.sha256
		const original = {
			id,
			path: `matchupimages/${originalPath}`,
			sha256: originalHash,
			status: action ? 'fix' : 'pass',
			category: action ? 'wrong_matchup' : 'correct_matchup',
			finalPath: relative,
		}
		baseline.push(original)
		if (action)
			rows.push({
				original: {
					id,
					path: original.path,
					sha256: originalHash,
					category: original.category,
				},
				action,
				final: {
					path: relative,
					sha256: entry.sha256,
					pairKey: entry.pairKey,
				},
			})
		if (oldPath)
			changes.push({
				id,
				sourcePath: original.path,
				path: relative,
				beforeSha256: originalHash,
				afterSha256: entry.sha256,
			})
	}
	for (const entry of m.entries) {
		entry.provenance.kind = newKeys.has(entry.pairKey)
			? 'sourced'
			: reuseKeys.has(entry.pairKey)
				? 'reuse'
				: 'audit'
		entry.provenance.sourcePath = newKeys.has(entry.pairKey)
			? `https://fixture.invalid/${entry.pairKey}`
			: 'fixture/source'
		if (entry !== missing)
			await add(
				entry,
				entry.path,
				newKeys.has(entry.pairKey)
					? 'replace'
					: reuseKeys.has(entry.pairKey)
						? 'reuse'
						: undefined,
			)
	}
	for (let i = 0; i < 5; i++)
		await add(newEntries[i + 1], `nba/ReplacementAlias${i}.jpg`, 'replace')
	const approved = m.entries.find((e) => e.provenance.kind === 'audit')!
	for (let i = 0; i < 484; i++) {
		const final =
			i < 32
				? `nfl/Commanders_Fixture${i}.jpg`
				: i < 34
					? `nfl/Fixture_vs_Pair${i}.jpg`
					: `nba/ApprovedAlias${i}.jpg`
		const old =
			i < 32
				? final.replace('Commanders', 'Redskins')
				: i < 34
					? final.replace('_vs_', '_Vs_')
					: undefined
		await add(approved, final, undefined, old)
	}
	baseline.push({
		id: 'SELF',
		path: 'matchupimages/nfl/Eagles_vs_Eagles.jpg',
		sha256: 'c'.repeat(64),
		status: 'fix',
		category: 'invalid_self_matchup',
		finalPath: null,
	})
	rows.push({
		original: {
			id: 'SELF',
			path: 'matchupimages/nfl/Eagles_vs_Eagles.jpg',
			sha256: 'c'.repeat(64),
			category: 'invalid_self_matchup',
		},
		action: 'remove',
	})
	await fs.writeFile(
		path.join(root, 'visual-review/receipt.json'),
		JSON.stringify({
			kind: 'visual-review',
			entries: m.entries.map((e) => ({
				pairKey: e.pairKey,
				teams: e.teams,
				sha256: e.sha256,
			})),
		}),
	)
	await fs.writeFile(
		path.join(root, 'source-provenance.json'),
		JSON.stringify({ teamsRevision: m.teamsRevision, sources }),
	)
	await fs.writeFile(
		path.join(root, 'baseline-inventory.json'),
		JSON.stringify({
			schemaVersion: 1,
			sourceArchiveSha256:
				'4f95364bdb460d1fc0df029fff17cf88a15ef6cacbff69b96ab92ec635fad8d7',
			files: baseline,
		}),
	)
	await fs.writeFile(
		path.join(root, 'repair-results.json'),
		JSON.stringify({
			repairs: rows,
			pathChanges: changes,
			auditDisallowedMappings: rows
				.filter((r) => r.action !== 'remove')
				.map((r) => ({
					pairKey: r.final.pairKey,
					sha256: r.original.sha256,
				})),
		}),
	)
	await writeFixtureManifest(root, m)
	return { assets, root, manifest: m }
}
describe('real-release evidence reconciliation with complete synthetic fixtures', () => {
	it('accepts complete hash-bound source,119 repair,1301 preservation and34 rename stubs', async () => {
		const f = await releaseFixture()
		expect((await validateAssets(f.assets, { schema })).pairs).toBe(931)
	}, 30000)
	it.each([
		'source-team',
		'source-hash',
		'duplicate-rename',
		'rename-hash',
		'baseline-pass',
		'bad-pair-hash',
	] as const)(
		'rejects %s evidence drift',
		async (kind) => {
			const f = await releaseFixture()
			const edit = async (file: string, mutate: (data: any) => void) => {
				const p = path.join(f.root, file),
					data = JSON.parse(await fs.readFile(p, 'utf8'))
				mutate(data)
				await fs.writeFile(p, JSON.stringify(data))
			}
			if (kind === 'source-team')
				await edit(
					'source-provenance.json',
					(d) => (d.sources[0].competitors[0].canonicalId = 'wrong'),
				)
			if (kind === 'source-hash')
				await edit(
					'source-provenance.json',
					(d) => (d.sources[0].sha256 = '0'.repeat(64)),
				)
			if (kind === 'duplicate-rename')
				await edit(
					'repair-results.json',
					(d) => (d.pathChanges[1] = d.pathChanges[0]),
				)
			if (kind === 'rename-hash')
				await edit(
					'repair-results.json',
					(d) => (d.pathChanges[0].afterSha256 = '0'.repeat(64)),
				)
			if (kind === 'baseline-pass')
				await edit(
					'baseline-inventory.json',
					(d) =>
						(d.files.find((r) => r.status === 'pass').sha256 =
							'0'.repeat(64)),
				)
			if (kind === 'bad-pair-hash')
				await edit(
					'repair-results.json',
					(d) =>
						(d.auditDisallowedMappings[0] = {
							pairKey: f.manifest.entries[0].pairKey,
							sha256: f.manifest.entries[0].sha256,
						}),
				)
			await expect(validateAssets(f.assets, { schema })).rejects.toThrow()
		},
		30000,
	)
})
