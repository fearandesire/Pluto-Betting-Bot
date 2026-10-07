import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const sha256 = (data) => createHash('sha256').update(data).digest('hex')
const xml = (value) =>
	String(value).replace(
		/[&<>"']/g,
		(c) =>
			({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&apos;',
			})[c],
	)
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
const json = async (file) => JSON.parse(await fs.readFile(file, 'utf8'))
const save = async (file, value) =>
	fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`)

export function parseCsv(text) {
	const rows = []
	let row = [],
		field = '',
		quoted = false
	for (let i = 0; i < text.length; i++) {
		const ch = text[i]
		if (ch === '"') {
			if (quoted && text[i + 1] === '"') {
				field += '"'
				i++
			} else quoted = !quoted
		} else if (ch === ',' && !quoted) {
			row.push(field)
			field = ''
		} else if (ch === '\n' && !quoted) {
			row.push(field.replace(/\r$/, ''))
			rows.push(row)
			row = []
			field = ''
		} else field += ch
	}
	if (quoted) throw new Error('unterminated_csv_quote')
	if (field || row.length) {
		row.push(field.replace(/\r$/, ''))
		rows.push(row)
	}
	const headers = rows.shift()
	return rows
		.filter((r) => r.some(Boolean))
		.map((r) => {
			if (r.length !== headers.length) throw new Error('invalid_csv_row')
			return Object.fromEntries(headers.map((h, i) => [h, r[i]]))
		})
}

async function safeFile(root, relative) {
	if (
		path.isAbsolute(relative) ||
		relative.includes('\\') ||
		relative.split('/').some((x) => !x || x === '.' || x === '..')
	)
		throw new Error(`unsafe_path:${relative}`)
	let current = root
	for (const component of relative.split('/')) {
		current = path.join(current, component)
		const stat = await fs.lstat(current)
		if (stat.isSymbolicLink()) throw new Error(`symlink_input:${relative}`)
	}
	return current
}

async function textImage(
	text,
	width,
	height,
	size,
	fontfile,
	color = '#ffffff',
) {
	return sharp({
		text: {
			text: `<span foreground="${color}">${xml(text)}</span>`,
			font: `DejaVu Sans Bold ${size}`,
			fontfile,
			width,
			height,
			align: 'centre',
			rgba: true,
		},
	})
		.png()
		.toBuffer()
}

async function renderCard(teamA, teamB, logoA, logoB) {
	const background = Buffer.from(
		`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${teamB.colors[0]}"/><path d="M0 0H400L0 400Z" fill="${teamA.colors[0]}"/><path d="M400 0L0 400" stroke="#ffffff" stroke-width="2"/></svg>`,
	)
	const composites = []
	for (const [logo, centerX, centerY] of [
		[logoA, 140, 140],
		[logoB, 270, 270],
	]) {
		const mark = await sharp(logo)
			.trim({ threshold: 10 })
			.resize(260, 260, { fit: 'inside', withoutEnlargement: false })
			.png()
			.toBuffer()
		const info = await sharp(mark).metadata()
		composites.push({
			input: mark,
			left: Math.round(centerX - info.width / 2),
			top: Math.round(centerY - info.height / 2),
		})
	}
	return sharp(background)
		.composite(composites)
		.jpeg({ quality: 95, chromaSubsampling: '4:4:4', progressive: false })
		.toBuffer()
}

async function sheet(records, mode, output, input, file, fontfile) {
	const width = 1920,
		cellWidth = 640,
		cellHeight = 442,
		height = 90 + Math.ceil(records.length / 3) * cellHeight
	const composites = []
	const label = async (text, x, y, w, h, size) => {
		const b = await textImage(text, w, h, size, fontfile)
		composites.push({ input: b, left: x, top: y })
	}
	await label(
		`${mode.toUpperCase()} — stable audit IDs / canonical pairs`,
		30,
		24,
		1860,
		45,
		28,
	)
	for (let i = 0; i < records.length; i++) {
		const r = records[i],
			x = (i % 3) * cellWidth,
			y = 90 + Math.floor(i / 3) * cellHeight
		const relative = mode === 'before' ? r.beforePath : r.afterPath
		if (relative) {
			const b = await sharp(
				path.join(mode === 'before' ? input : output, relative),
			)
				.resize(610, 343, { fit: 'contain', background: '#1a2230' })
				.jpeg({ quality: 88 })
				.toBuffer()
			composites.push({ input: b, left: x + 15, top: y + 8 })
		} else
			await label(
				mode === 'before'
					? 'No existing asset'
					: 'Removed invalid self-matchup',
				x + 15,
				y + 145,
				610,
				70,
				24,
			)
		await label(`${r.id}  ${r.pairKey}`, x + 15, y + 360, 610, 35, 18)
		await label(
			`${r.action}  ${(mode === 'before' ? r.beforeSha256 : r.afterSha256)?.slice(0, 16) ?? '—'}`,
			x + 15,
			y + 400,
			610,
			27,
			17,
		)
	}
	await sharp({
		create: { width, height, channels: 3, background: '#101724' },
	})
		.composite(composites)
		.jpeg({ quality: 91, chromaSubsampling: '4:4:4' })
		.toFile(file)
}

export async function build({
	input,
	audit,
	output,
	evidence,
	logos = path.join(here, 'logos'),
	originals = path.join(here, 'originals'),
}) {
	input = await fs.realpath(path.resolve(input))
	audit = await fs.realpath(path.resolve(audit))
	output = path.resolve(output)
	evidence = path.resolve(evidence)
	logos = await fs.realpath(path.resolve(logos))
	originals = await fs.realpath(path.resolve(originals))
	if (
		output === evidence ||
		output.startsWith(evidence + path.sep) ||
		evidence.startsWith(output + path.sep)
	)
		throw new Error('output_evidence_overlap')
	// Refuse overlay builds and any overlap with the immutable baseline or frozen audit.
	for (const dest of [output, evidence]) {
		for (const source of [input, audit, logos, originals])
			if (
				dest === source ||
				dest.startsWith(source + path.sep) ||
				source.startsWith(dest + path.sep)
			)
				throw new Error('input_output_overlap')
		await fs.mkdir(path.dirname(dest), { recursive: true })
		const parent = await fs.realpath(path.dirname(dest))
		if (parent !== path.dirname(dest))
			throw new Error('symlink_output_parent')
		try {
			const stat = await fs.lstat(dest)
			if (
				stat.isSymbolicLink() ||
				!stat.isDirectory() ||
				(await fs.readdir(dest)).length
			)
				throw new Error(`nonempty_output:${dest}`)
		} catch (e) {
			if (e.code !== 'ENOENT') throw e
		}
		await fs.mkdir(dest, { recursive: true })
	}
	const rawTeams = await fs.readFile(path.join(here, 'teams.json'))
	const registry = JSON.parse(rawTeams),
		teamsRevision = sha256(JSON.stringify(registry))
	const teamFor = (sport, name) => {
		const matches =
			registry[sport]?.filter(
				(t) =>
					t.id === name ||
					t.name === name ||
					t.aliases.includes(name),
			) ?? []
		if (matches.length !== 1)
			throw new Error(`unknown_team:${sport}:${name}`)
		return matches[0]
	}
	const identify = (r) =>
		[teamFor(r.sport, r.team_a), teamFor(r.sport, r.team_b)].sort((a, b) =>
			cmp(a.id, b.id),
		)
	const keyFor = (r) =>
		`${r.sport}:${identify(r)
			.map((t) => t.id)
			.join(':')}`
	const normalize = (p) =>
		p
			.replace(/^matchupimages\//, '')
			.replace(/_Vs_/g, '_vs_')
			.replace(/Redskins/g, 'Commanders')
	const records = await json(path.join(audit, 'audit-results.json'))
	const fixes = parseCsv(
		await fs.readFile(path.join(audit, 'fixes.csv'), 'utf8'),
	)
	const byPath = new Map(records.map((r) => [r.path, r])),
		byDestination = new Map(),
		pairs = new Map(),
		actions = [],
		pathChanges = []
	const fixPaths = new Set(fixes.map((r) => r.filename))
	if (
		records.length !== 1420 ||
		fixes.length !== 119 ||
		fixPaths.size !== 119
	)
		throw new Error('unexpected_frozen_worklist')
	for (const r of records) {
		if ((r.status === 'fix') !== fixPaths.has(r.path))
			throw new Error(`audit_fix_disagreement:${r.path}`)
		const file = await safeFile(
			input,
			r.path.replace(/^matchupimages\//, ''),
		)
		if (sha256(await fs.readFile(file)) !== r.sha256)
			throw new Error(`baseline_drift:${r.path}`)
		const ts = identify(r),
			dest = normalize(r.path)
		if (ts[0].id === ts[1].id) continue
		if (byDestination.has(dest))
			throw new Error(`normalized_path_collision:${dest}`)
		byDestination.set(dest, r.path)
		const k = keyFor(r)
		if (!pairs.has(k)) pairs.set(k, [])
		pairs.get(k).push(r)
		if (dest !== r.path.replace(/^matchupimages\//, ''))
			pathChanges.push({
				id: r.id,
				sourcePath: r.path,
				path: dest,
				beforeSha256: r.sha256,
			})
	}
	const logoSources = await json(path.join(logos, 'provenance.json')),
		logoMap = new Map()
	for (const source of logoSources.sources) {
		const bytes = await fs.readFile(await safeFile(logos, source.file))
		if (
			sha256(bytes) !== source.sha256 ||
			teamFor(source.sport, source.teamId).name !== source.teamName
		)
			throw new Error(`logo_provenance_drift:${source.teamId}`)
		logoMap.set(`${source.sport}:${source.teamId}`, bytes)
	}
	const originalSources = await json(path.join(originals, 'provenance.json')),
		originalMap = new Map()
	if (originalSources.teamsRevision !== teamsRevision)
		throw new Error('original_source_registry_drift')
	for (const source of originalSources.sources) {
		if (source.status !== 'recovered') continue
		const bytes = await fs.readFile(await safeFile(originals, source.file))
		if (
			sha256(bytes) !== source.sha256 ||
			`${source.sport}:${source.teams.slice().sort(cmp).join(':')}` !==
				source.pairKey ||
			source.competitors
				.map((c) => c.canonicalId)
				.sort(cmp)
				.join(':') !== source.teams.join(':')
		)
			throw new Error(
				`original_source_provenance_drift:${source.pairKey}`,
			)
		const meta = await sharp(bytes).metadata()
		if (meta.width !== 400 || meta.height !== 400 || meta.format !== 'png')
			throw new Error(`original_source_format_drift:${source.pairKey}`)
		if (originalMap.has(source.pairKey))
			throw new Error('duplicate_original_source_pair')
		originalMap.set(source.pairKey, { bytes, source })
	}
	const fontfile = path.join(here, 'fonts/DejaVuSans-Bold.ttf'),
		generated = new Map(),
		reuse = new Map()
	for (const f of fixes) {
		const r = byPath.get(f.filename),
			k = keyFor(r),
			ts = identify(r)
		if (ts[0].id === ts[1].id) {
			actions.push({
				id: r.id,
				pairKey: k,
				teams: ts.map((t) => t.id),
				action: 'remove',
				beforePath: r.path.replace(/^matchupimages\//, ''),
				beforeSha256: r.sha256,
				afterPath: null,
				afterSha256: null,
				reason: r.reason,
			})
			continue
		}
		if (f.reuse_candidates) {
			const source = byPath.get(f.reuse_candidates.split(';')[0])
			if (!source || source.status !== 'pass' || keyFor(source) !== k)
				throw new Error(`invalid_reuse_source:${r.id}`)
			const bytes = await fs.readFile(
				await safeFile(
					input,
					source.path.replace(/^matchupimages\//, ''),
				),
			)
			if (sha256(bytes) !== source.sha256)
				throw new Error(`reuse_source_drift:${r.id}`)
			reuse.set(r.path, { bytes, source })
		} else if (!generated.has(k))
			generated.set(k, {
				sport: r.sport,
				ts,
				auditIds: [],
				destinations: [],
			})
	}
	generated.set('nfl:bears:commanders', {
		sport: 'nfl',
		ts: [teamFor('nfl', 'bears'), teamFor('nfl', 'commanders')],
		auditIds: [],
		destinations: ['nfl/Bears_vs_Commanders.jpg'],
	})
	if (reuse.size !== 12 || generated.size !== 102 || actions.length !== 1)
		throw new Error('unexpected_repair_classification')
	for (const [k, g] of generated) {
		const original = originalMap.get(k)
		if (original) {
			g.bytes = original.bytes
			g.source = original.source
			g.kind = 'sourced'
		} else {
			const attempt = originalSources.sources.find((s) => s.pairKey === k)
			if (
				!attempt ||
				attempt.status !== 'unavailable' ||
				!attempt.attempts.length
			)
				throw new Error(`no_source_recovery_attempt:${k}`)
			const marks = g.ts.map((t) => logoMap.get(`${g.sport}:${t.id}`))
			if (marks.some((m) => !m))
				throw new Error(`missing_verified_logo:${k}`)
			g.bytes = await renderCard(...g.ts, ...marks)
			g.kind = 'generated'
			g.source = attempt
		}
		g.sha256 = sha256(g.bytes)
	}
	const staged = []
	for (const r of records) {
		const ts = identify(r),
			k = keyFor(r)
		if (ts[0].id === ts[1].id) continue
		const dest = normalize(r.path),
			reused = reuse.get(r.path),
			g = r.status === 'fix' && !reused ? generated.get(k) : null
		const bytes =
			g?.bytes ??
			reused?.bytes ??
			(await fs.readFile(
				await safeFile(input, r.path.replace(/^matchupimages\//, '')),
			))
		const digest = sha256(bytes)
		if (r.status === 'pass' && digest !== r.sha256)
			throw new Error(`approved_bytes_changed:${r.id}`)
		await fs.mkdir(path.dirname(path.join(output, dest)), {
			recursive: true,
		})
		await fs.writeFile(path.join(output, dest), bytes, { flag: 'wx' })
		const meta = await sharp(bytes).metadata()
		const s = {
			pairKey: k,
			sport: r.sport,
			teams: ts.map((t) => t.id),
			path: dest,
			sha256: digest,
			width: meta.width,
			height: meta.height,
			mime: `image/${meta.format}`,
			orderIndependent: true,
			approval:
				r.status === 'pass'
					? {
							teams: ts.map((t) => t.id),
							sha256: digest,
							evidence: `audit:${r.evidence_sheet}`,
						}
					: {
							teams: [],
							sha256: digest,
							evidence: 'pending:visual-review',
						},
			provenance: {
				kind: g ? g.kind : reused ? 'reuse' : 'audit',
				auditId: r.id,
				sourcePath:
					g?.kind === 'sourced'
						? g.source.imageUrl
						: (reused?.source.path ?? r.path),
			},
		}
		staged.push(s)
		if (g) {
			g.auditIds.push(r.id)
			g.destinations.push(dest)
		}
		if (r.status === 'fix')
			actions.push({
				id: r.id,
				pairKey: k,
				teams: ts.map((t) => t.id),
				action: reused ? 'reuse' : 'replace',
				beforePath: r.path.replace(/^matchupimages\//, ''),
				beforeSha256: r.sha256,
				afterPath: dest,
				afterSha256: digest,
				sourcePath: reused?.source.path ?? null,
				sourceSha256: reused?.source.sha256 ?? null,
				reason: r.reason,
				approval: 'pending',
			})
	}
	const missing = generated.get('nfl:bears:commanders')
	if (byDestination.has(missing.destinations[0]))
		throw new Error('missing_pair_destination_collision')
	await fs.writeFile(
		path.join(output, missing.destinations[0]),
		missing.bytes,
		{ flag: 'wx' },
	)
	staged.push({
		pairKey: 'nfl:bears:commanders',
		sport: 'nfl',
		teams: ['bears', 'commanders'],
		path: missing.destinations[0],
		sha256: missing.sha256,
		width: 400,
		height: 400,
		mime: missing.kind === 'sourced' ? 'image/png' : 'image/jpeg',
		orderIndependent: true,
		approval: {
			teams: [],
			sha256: missing.sha256,
			evidence: 'pending:visual-review',
		},
		provenance: {
			kind: missing.kind,
			auditId: 'NEW-BEARS-COMMANDERS',
			sourcePath:
				missing.kind === 'sourced'
					? missing.source.imageUrl
					: 'worklist:missing:nfl:bears:commanders',
		},
	})
	actions.sort((a, b) => cmp(a.id, b.id))
	const additions = [
		{
			id: 'NEW-BEARS-COMMANDERS',
			pairKey: 'nfl:bears:commanders',
			teams: ['bears', 'commanders'],
			action: 'add',
			beforePath: null,
			beforeSha256: null,
			afterPath: missing.destinations[0],
			afterSha256: missing.sha256,
			approval: 'pending',
		},
	]
	const selected = new Map()
	// Prefer newly repaired content, then an audited approved source, with stable path tie-breaking.
	const rank = (e) =>
		['sourced', 'generated'].includes(e.provenance.kind)
			? 0
			: e.provenance.kind === 'reuse'
				? 1
				: 2
	for (const e of staged.sort(
		(a, b) => rank(a) - rank(b) || cmp(a.path, b.path),
	))
		if (!selected.has(e.pairKey)) selected.set(e.pairKey, e)
	const entries = [...selected.values()].sort((a, b) =>
		cmp(a.pairKey, b.pairKey),
	)
	const expected = Object.values(registry).reduce(
		(n, t) => n + (t.length * (t.length - 1)) / 2,
		0,
	)
	if (
		expected !== 931 ||
		entries.length !== expected ||
		staged.length !== 1420
	)
		throw new Error('incomplete_candidate_coverage')
	const manifest = {
		schemaVersion: 1,
		releaseId: sha256(JSON.stringify({ teamsRevision, entries })),
		teamsRevision,
		entries,
	}
	for (const change of pathChanges)
		change.afterSha256 = staged.find((s) => s.path === change.path).sha256
	await save(path.join(output, 'manifest.json'), manifest)
	const generation = [...generated.entries()]
		.sort(([a], [b]) => cmp(a, b))
		.map(([pairKey, g], i) => ({
			id: `G${String(i + 1).padStart(3, '0')}`,
			pairKey,
			kind: g.kind,
			sport: g.sport,
			teams: g.ts.map((t) => t.id),
			teamNames: g.ts.map((t) => t.name),
			sha256: g.sha256,
			source: g.source,
			auditIds: g.auditIds.sort(cmp),
			destinations: g.destinations.sort(cmp),
			approval: 'pending',
		}))
	const review = [...actions, ...additions]
	const sheets = []
	for (let i = 0; i < review.length; i += 12) {
		const page = String(i / 12 + 1).padStart(3, '0'),
			subset = review.slice(i, i + 12)
		for (const mode of ['before', 'after'])
			await sheet(
				subset,
				mode,
				output,
				input,
				path.join(evidence, `${mode}-${page}.jpg`),
				fontfile,
			)
		sheets.push({
			before: `before-${page}.jpg`,
			after: `after-${page}.jpg`,
			ids: subset.map((r) => r.id),
		})
	}
	const repairs = actions.map((a) => ({
		original: {
			id: a.id,
			path: `matchupimages/${a.beforePath}`,
			sha256: a.beforeSha256,
			category: byPath.get(`matchupimages/${a.beforePath}`).category,
		},
		action: a.action,
		...(a.afterPath
			? {
					final: {
						path: a.afterPath,
						sha256: a.afterSha256,
						pairKey: a.pairKey,
					},
				}
			: {}),
	}))
	const results = {
		schemaVersion: 1,
		teamsRevision,
		manifestSha256: sha256(
			await fs.readFile(path.join(output, 'manifest.json')),
		),
		renderer: {
			sharp: sharp.versions,
			fontSha256: sha256(await fs.readFile(fontfile)),
			width: 400,
			height: 400,
			jpegQuality: 95,
			note: 'Recovered originals are copied byte-for-byte; renderer applies only to unavailable source fallbacks.',
		},
		counts: {
			baseline: records.length,
			originalActions: actions.length,
			reused: reuse.size,
			replacementTargets: actions.filter((a) => a.action === 'replace')
				.length,
			removed: 1,
			newCards: generated.size,
			sourced: generation.filter((g) => g.kind === 'sourced').length,
			generated: generation.filter((g) => g.kind === 'generated').length,
			additions: 1,
			candidateFiles: staged.length,
			canonicalPairs: entries.length,
			approvedBytesPreserved: records.filter((r) => r.status === 'pass')
				.length,
		},
		repairs,
		actions,
		additions,
		generated: generation,
		physicalFiles: staged.sort((a, b) => cmp(a.path, b.path)),
		pathChanges,
		sheets,
		logoProvenance: logoSources,
		sourceProvenance: originalSources,
	}
	await save(path.join(output, 'baseline-inventory.json'), {
		schemaVersion: 1,
		sourceArchiveSha256:
			'4f95364bdb460d1fc0df029fff17cf88a15ef6cacbff69b96ab92ec635fad8d7',
		files: records.map((r) => ({
			id: r.id,
			path: r.path,
			sha256: r.sha256,
			status: r.status,
			category: r.category,
			finalPath:
				r.category === 'invalid_self_matchup'
					? null
					: normalize(r.path),
		})),
	})
	await save(path.join(output, 'repair-results.json'), {
		schemaVersion: 1,
		teamsRevision,
		repairs,
		additions,
		pathChanges,
		auditDisallowedMappings: actions
			.filter((a) => a.action !== 'remove')
			.map((a) => ({ pairKey: a.pairKey, sha256: a.beforeSha256 })),
	})
	await save(path.join(output, 'source-provenance.json'), originalSources)
	await save(path.join(evidence, 'repair-results.json'), results)
	await save(path.join(evidence, 'pending-review.json'), {
		schemaVersion: 1,
		generated: generation,
		actions: review.filter((a) => a.afterPath),
		note: 'Record observed team IDs and exact new sha256 after actual visual inspection; no pending receipt is release approval.',
	})
	const boardRows = review.map(
		(r) =>
			`<article id="${xml(r.id)}"><h2>${xml(r.id)} · ${xml(r.action)} · ${xml(r.pairKey)}</h2><div class="images">${r.beforePath ? `<figure><img loading="lazy" src="data:${byPath.get('matchupimages/' + r.beforePath)?.format === 'PNG' ? 'image/png' : 'image/jpeg'};base64,${''}" data-before="${xml(r.beforePath)}"><figcaption>Before</figcaption></figure>` : '<figure>No existing asset</figure>'}${r.afterPath ? `<figure><img loading="lazy" src="../../../../candidate/matchupimages/${xml(r.afterPath)}"><figcaption>After</figcaption></figure>` : '<figure>Removed invalid self-matchup</figure>'}</div><p>Source: ${xml(r.beforePath ?? 'missing')}<br>Destination: ${xml(r.afterPath ?? 'removed')}<br>Before SHA256: ${xml(r.beforeSha256 ?? 'none')}<br>After SHA256: ${xml(r.afterSha256 ?? 'none')}</p></article>`,
	)
	// Embed baseline thumbnails so the board remains reviewable without modifying or shipping the baseline.
	for (let i = 0; i < review.length; i++)
		if (review[i].beforePath) {
			const thumbnail = await sharp(
				path.join(input, review[i].beforePath),
			)
				.resize(640, 360, { fit: 'contain', background: '#101724' })
				.jpeg({ quality: 82 })
				.toBuffer()
			boardRows[i] = boardRows[i].replace(
				/src="data:[^"]*"/,
				`src="data:image/jpeg;base64,${thumbnail.toString('base64')}"`,
			)
		}
	// All after paths are relative to this board's actual location, not a fixed workspace layout.
	const prefix = path.relative(evidence, output).split(path.sep).join('/')
	await fs.writeFile(
		path.join(evidence, 'repair-board.html'),
		`<!doctype html><meta charset="utf-8"><title>Pluto matchup image repair</title><style>body{font:15px system-ui;background:#101724;color:#f7f8fa;margin:32px}h1{font-size:30px}article{border-top:1px solid #405064;padding:24px 0}.images{display:flex;gap:24px}figure{margin:0;width:48%}img{width:100%;max-width:640px}p{overflow-wrap:anywhere;font-family:monospace;line-height:1.6}a{color:#80cfff}</style><h1>119 audited actions + Bears–Commanders</h1><p>Pending actual visual review. Stable audit IDs, canonical identities, source/destination paths, exact hashes. ${results.counts.sourced} recovered originals and ${results.counts.generated} matching generated fallbacks; 12 verified reuse sources. This board is local review evidence.</p>${boardRows.join('\n').replaceAll('../../../../candidate/matchupimages', prefix)}`,
	)
	await fs.writeFile(
		path.join(evidence, 'artwork-report.md'),
		`# Matchup artwork build\n\nStaged ${staged.length} physical files and ${entries.length} canonical pairs. ${actions.length} audited rows close as 106 replacement targets, 12 reuse targets, and one removed invalid self-matchup. ${results.counts.sourced} recovered 400×400 PNG originals are copied byte-for-byte; ${results.counts.generated} unavailable pairs use matching square diagonal JPEG fallbacks. The 102 new cards include Bears–Commanders; 101 repair pairs map to 106 filenames.\n\nAll ${results.counts.approvedBytesPreserved} audited pass files preserve original bytes. Every baseline hash was checked before staging. Reuse source hashes were checked immediately before copying. ${pathChanges.length} path normalizations were collision-checked. Original baseline and audit inputs remain untouched.\n\nReview: repair-board.html, before/after-001 through -010.jpg, pending-review.json. Approvals for every new/reused image remain pending coordinator visual inspection. Manifest releaseId is provisional until approvals are finalized.\n\nOriginals: public ESPN stitcher images from the observed original asset family, with exact competitor identities checked against bounded public ESPN scoreboards. Each source page, image URL, event date, competitors, source attempts, and SHA256 is in sourceProvenance. Direct Google image search encountered an unusual-traffic CAPTCHA; it was not bypassed. Free public image-search discovery identified the ESPN family.\n\nFallback logos: [official NFL teams directory](https://www.nfl.com/teams/) and [official NBA teams directory](https://www.nba.com/teams). Cached bytes and bundled DejaVu Sans Bold font are hash-recorded. No paid services, image generation services, or cropping of cached matchup cards were used.\n\nRenderer versions and font hash: repair-results.json. Builder never uploads and refuses input/output overlap, symlinks, nonempty destinations, drift, and normalization collisions.\n`,
	)
	return results.counts
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const args = process.argv.slice(2),
		options = {}
	if (args.includes('--help')) {
		console.log(
			'node scripts/matchup-assets/build.mjs --input <baseline/matchupimages> --audit <frozen-audit> --output <candidate/matchupimages> --evidence <review-dir> [--logos <logo-cache>] [--originals <recovered-originals>]',
		)
	} else {
		for (let i = 0; i < args.length; i += 2) {
			if (
				![
					'--input',
					'--audit',
					'--output',
					'--evidence',
					'--logos',
					'--originals',
				].includes(args[i]) ||
				!args[i + 1] ||
				args[i + 1].startsWith('--')
			)
				throw new Error('invalid_builder_arguments')
			const k = args[i].slice(2)
			if (k in options) throw new Error('duplicate_builder_argument')
			options[k] = args[i + 1]
		}
		if (['input', 'audit', 'output', 'evidence'].some((k) => !options[k]))
			throw new Error('missing_builder_arguments')
		console.log(JSON.stringify(await build(options)))
	}
}
