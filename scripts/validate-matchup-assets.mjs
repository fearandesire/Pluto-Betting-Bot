import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
export async function validateAssets(assetsRoot, options = {}) {
	const schema =
		options.schema ??
		(await import('../dist/utils/guilds/channels/matchup-image-schema.js'))
	const root = path.join(path.resolve(assetsRoot), 'matchupimages')
	const realRoot = await fs.realpath(root)
	if ((await fs.lstat(root)).isSymbolicLink() || realRoot !== root)
		throw new Error('asset_root_symlink')
	const physicalImages = new Set()
	const inspect = async (directory) => {
		for (const name of await fs.readdir(directory)) {
			const file = path.join(directory, name),
				stat = await fs.lstat(file)
			if (stat.isSymbolicLink() || !(stat.isDirectory() || stat.isFile()))
				throw new Error('unsafe_asset_type')
			if (stat.isDirectory()) await inspect(file)
			else if (/\.(jpg|jpeg|png)$/i.test(name))
				physicalImages.add(
					path.relative(root, file).replaceAll(path.sep, '/'),
				)
		}
	}
	await inspect(root)
	const manifest = schema.validateMatchupManifest(
		JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8')),
	)
	if (
		!options.fixture &&
		manifest.entries.some((entry) =>
			/fixture|pending|placeholder|synthetic/i.test(
				entry.approval.evidence,
			),
		)
	)
		throw new Error('unreviewed_artwork')
	const decoded = new Map()
	let sourceProvenance
	if (
		!options.fixture &&
		manifest.entries.some((e) => e.provenance.kind === 'sourced')
	) {
		sourceProvenance = JSON.parse(
			await fs.readFile(
				path.join(root, 'source-provenance.json'),
				'utf8',
			),
		)
		if (sourceProvenance.teamsRevision !== manifest.teamsRevision)
			throw new Error('source_identity_revision')
	}
	const receipts = new Map()
	for (const entry of manifest.entries) {
		if (entry.provenance.kind === 'sourced' && !options.fixture) {
			const source = sourceProvenance.sources?.find(
				(source) =>
					source.pairKey === entry.pairKey &&
					source.status === 'recovered',
			)
			if (
				!source ||
				source.sha256 !== entry.sha256 ||
				source.imageUrl !== entry.provenance.sourcePath ||
				JSON.stringify(source.teams) !== JSON.stringify(entry.teams) ||
				source.competitors?.length !== 2 ||
				JSON.stringify(
					source.competitors.map((c) => c.canonicalId).sort(),
				) !== JSON.stringify(entry.teams)
			)
				throw new Error('source_provenance_mismatch')
		}
		if (!entry.approval.evidence.startsWith('audit:')) {
			const evidencePath = entry.approval.evidence
			if (!receipts.has(evidencePath))
				receipts.set(
					evidencePath,
					JSON.parse(
						await fs.readFile(
							path.join(root, evidencePath),
							'utf8',
						),
					),
				)
			const receipt = receipts.get(evidencePath)
			if (
				(!options.fixture && receipt.kind !== 'visual-review') ||
				!Array.isArray(receipt.entries) ||
				!receipt.entries.some(
					(r) =>
						r.pairKey === entry.pairKey &&
						r.sha256 === entry.sha256 &&
						JSON.stringify(r.teams) === JSON.stringify(entry.teams),
				)
			)
				throw new Error('approval_receipt_mismatch')
		}
		const file = path.join(root, entry.path)
		const stat = await fs.lstat(file)
		if (!stat.isFile() || stat.isSymbolicLink())
			throw new Error('unsafe_asset_type')
		const actual = await fs.realpath(file)
		if (!actual.startsWith(realRoot + path.sep))
			throw new Error('unsafe_asset_path')
		const bytes = await fs.readFile(file)
		if (hash(bytes) !== entry.sha256)
			throw new Error('asset_digest_mismatch')
		if (!schema.validateImageBytes(bytes, entry))
			throw new Error('invalid_image_bytes')
		if (!decoded.has(entry.sha256)) {
			const image = sharp(bytes, { failOn: 'warning' }),
				metadata = await image.metadata()
			await image.raw().toBuffer() // Decode the entire image; header-only checks cannot detect truncated pixels.
			decoded.set(entry.sha256, metadata)
		}
		const metadata = decoded.get(entry.sha256)
		if (
			`image/${metadata.format}` !== entry.mime ||
			metadata.width !== entry.width ||
			metadata.height !== entry.height
		)
			throw new Error('decoded_image_mismatch')
		if (
			!options.fixture &&
			entry.provenance.kind === 'generated' &&
			(!entry.path.endsWith('.jpg') ||
				entry.mime !== 'image/jpeg' ||
				entry.width !== entry.height ||
				entry.width < 400)
		)
			throw new Error('generated_image_format')
		if (
			!options.fixture &&
			entry.provenance.kind === 'sourced' &&
			(entry.width !== entry.height || entry.width < 400)
		)
			throw new Error('sourced_image_format')
	}
	if (
		!options.fixture &&
		manifest.entries.filter((e) =>
			['generated', 'sourced'].includes(e.provenance.kind),
		).length !== 102
	)
		throw new Error('new_card_coverage')
	const repairsFile = path.join(root, 'repair-results.json')
	let repairs
	try {
		repairs = JSON.parse(await fs.readFile(repairsFile, 'utf8'))
	} catch {
		if (!options.fixture) throw new Error('repair_evidence_missing')
	}
	if (repairs && !options.fixture) {
		if (
			!Array.isArray(repairs.auditDisallowedMappings) ||
			repairs.auditDisallowedMappings.length !== 118
		)
			throw new Error('audit_bad_mappings_missing')
		for (const entry of manifest.entries)
			if (
				repairs.auditDisallowedMappings.some(
					(bad) =>
						bad.pairKey === entry.pairKey &&
						bad.sha256 === entry.sha256,
				)
			)
				throw new Error('historical_bad_mapping')
		const rows = Array.isArray(repairs) ? repairs : repairs.repairs
		if (!Array.isArray(rows) || rows.length !== 119)
			throw new Error('repair_coverage_mismatch')
		const ids = new Set(),
			filenames = new Set(),
			actionCounts = {}
		for (const row of rows) {
			if (!['reuse', 'replace', 'remove'].includes(row.action))
				throw new Error('repair_action_missing')
			actionCounts[row.action] = (actionCounts[row.action] ?? 0) + 1
			const original = row.original ?? row
			const id = original.id ?? row.id,
				filename =
					original.path ?? original.filename ?? row.originalPath
			if (
				!id ||
				!filename ||
				ids.has(id) ||
				filenames.has(filename) ||
				!/^[a-f0-9]{64}$/.test(original.sha256 ?? row.originalSha256)
			)
				throw new Error('repair_identity_mismatch')
			ids.add(id)
			filenames.add(filename)
			if (row.action === 'remove') {
				if (filename !== 'matchupimages/nfl/Eagles_vs_Eagles.jpg')
					throw new Error('invalid_removal')
				try {
					await fs.access(
						path.join(
							root,
							filename.replace(/^matchupimages\//, ''),
						),
					)
					throw new Error('removed_file_present')
				} catch (error) {
					if (error.code !== 'ENOENT') throw error
				}
			} else {
				const destination = row.final ?? row.destination
				if (
					!destination?.path ||
					!/^[a-f0-9]{64}$/.test(destination.sha256)
				)
					throw new Error('repair_final_missing')
				const finalPath = destination.path.replace(
					/^matchupimages\//,
					'',
				)
				if (!/^(nba|nfl)\/[A-Za-z0-9_-]+\.jpg$/.test(finalPath))
					throw new Error('repair_final_path')
				const bytes = await fs.readFile(path.join(root, finalPath))
				if (hash(bytes) !== destination.sha256)
					throw new Error('repair_digest_mismatch')
				const mapped = manifest.entries.find(
					(e) => e.pairKey === destination.pairKey,
				)
				if (!mapped || destination.sha256 !== mapped.sha256)
					throw new Error('repair_pair_mismatch')
				if (
					original.category !== 'invalid_self_matchup' &&
					destination.sha256 ===
						(original.sha256 ?? row.originalSha256)
				)
					throw new Error('repair_unchanged')
			}
		}
		if (
			actionCounts.reuse !== 12 ||
			actionCounts.replace !== 106 ||
			actionCounts.remove !== 1
		)
			throw new Error('repair_action_counts')
	}
	if (!options.fixture) {
		const baseline = JSON.parse(
			await fs.readFile(
				path.join(root, 'baseline-inventory.json'),
				'utf8',
			),
		)
		if (
			baseline.schemaVersion !== 1 ||
			baseline.sourceArchiveSha256 !==
				'4f95364bdb460d1fc0df029fff17cf88a15ef6cacbff69b96ab92ec635fad8d7' ||
			baseline.files?.length !== 1420
		)
			throw new Error('baseline_inventory_missing')
		const expected = new Set(),
			sourcePaths = new Set(),
			ids = new Set()
		let preserved = 0,
			renamed = 0
		for (const source of baseline.files) {
			if (
				!source.id ||
				ids.has(source.id) ||
				sourcePaths.has(source.path) ||
				!/^matchupimages\/(nba|nfl)\/[A-Za-z0-9_-]+\.jpg$/.test(
					source.path,
				) ||
				!/^[a-f0-9]{64}$/.test(source.sha256)
			)
				throw new Error('baseline_identity_mismatch')
			ids.add(source.id)
			sourcePaths.add(source.path)
			const originalPath = source.path.replace(/^matchupimages\//, '')
			const normalized = originalPath
				.replace(/_Vs_/g, '_vs_')
				.replace(/Redskins/g, 'Commanders')
			if (source.category === 'invalid_self_matchup') {
				if (
					source.path !== 'matchupimages/nfl/Eagles_vs_Eagles.jpg' ||
					source.finalPath !== null
				)
					throw new Error('baseline_removal_mismatch')
				continue
			}
			if (source.finalPath !== normalized || expected.has(normalized))
				throw new Error('baseline_normalization_mismatch')
			expected.add(normalized)
			if (normalized !== originalPath) renamed++
			if (source.status === 'pass') {
				if (
					hash(await fs.readFile(path.join(root, normalized))) !==
					source.sha256
				)
					throw new Error('approved_baseline_bytes_changed')
				preserved++
			} else if (source.status === 'fix') {
				const row = repairs.repairs.find(
					(row) => row.original.id === source.id,
				)
				if (
					!row ||
					row.original.path !== source.path ||
					row.original.sha256 !== source.sha256 ||
					row.original.category !== source.category ||
					row.final?.path !== normalized
				)
					throw new Error('baseline_repair_mismatch')
			} else throw new Error('baseline_unreviewed')
		}
		expected.add('nfl/Bears_vs_Commanders.jpg')
		if (
			preserved !== 1301 ||
			renamed !== 34 ||
			expected.size !== 1420 ||
			physicalImages.size !== expected.size ||
			[...physicalImages].some((p) => !expected.has(p))
		)
			throw new Error('baseline_physical_coverage')
		if (repairs.pathChanges?.length !== 34)
			throw new Error('rename_evidence_mismatch')
		const renameIds = new Set(),
			renameSources = new Set()
		for (const change of repairs.pathChanges) {
			const source = baseline.files.find(
				(source) =>
					source.id === change.id &&
					source.path === change.sourcePath &&
					source.finalPath === change.path &&
					source.sha256 === change.beforeSha256,
			)
			if (
				!source ||
				source.path.replace(/^matchupimages\//, '') ===
					source.finalPath ||
				renameIds.has(change.id) ||
				renameSources.has(change.sourcePath) ||
				hash(await fs.readFile(path.join(root, change.path))) !==
					change.afterSha256
			)
				throw new Error('rename_evidence_mismatch')
			renameIds.add(change.id)
			renameSources.add(change.sourcePath)
		}
	}

	return {
		status: 'passed',
		releaseId: manifest.releaseId,
		manifestSha256: hash(
			await fs.readFile(path.join(root, 'manifest.json')),
		),
		pairs: manifest.entries.length,
		orderedLookups: manifest.entries.length * 2,
		uniqueImages: decoded.size,
		repairs: repairs ? 119 : 0,
	}
}
if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		const args = process.argv.slice(2).filter((arg) => arg !== '--'),
			index = args.indexOf('--dir')
		if (index < 0 || !args[index + 1])
			throw new Error(
				'Usage: assets:validate -- --dir <assets-root>; run pnpm build first',
			)
		console.log(
			JSON.stringify(await validateAssets(args[index + 1]), null, 2),
		)
	} catch (error) {
		console.error(`Asset validation failed: ${error.message}`)
		process.exitCode = 1
	}
}
