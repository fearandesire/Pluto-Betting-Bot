import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { parseCsv } from './build.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const sha256 = (data) => createHash('sha256').update(data).digest('hex')
const save = async (file, data) =>
	fs.writeFile(file, `${JSON.stringify(data, null, 2)}\n`)

async function fetchBytes(url) {
	const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
	if (!response.ok) throw new Error(`http_${response.status}`)
	const bytes = Buffer.from(await response.arrayBuffer())
	if (bytes.length > 32 * 1024 * 1024) throw new Error('oversize_source')
	return bytes
}

export async function recover({ audit, output, evidence }) {
	audit = await fs.realpath(path.resolve(audit))
	output = path.resolve(output)
	evidence = path.resolve(evidence)
	for (const dest of [output, evidence]) {
		if (
			dest === audit ||
			audit.startsWith(dest + path.sep) ||
			dest.startsWith(audit + path.sep)
		)
			throw new Error('source_audit_overlap')
		try {
			const stat = await fs.lstat(dest)
			if (
				stat.isSymbolicLink() ||
				!stat.isDirectory() ||
				(await fs.readdir(dest)).length
			)
				throw new Error('nonempty_source_output')
		} catch (error) {
			if (error.code !== 'ENOENT') throw error
		}
		await fs.mkdir(dest, { recursive: true })
		if ((await fs.realpath(dest)) !== dest)
			throw new Error('symlink_source_destination')
	}
	const registry = JSON.parse(
		await fs.readFile(path.join(here, 'teams.json'), 'utf8'),
	)
	const resolve = (sport, label) => {
		const matches = registry[sport].filter((t) =>
			[t.id, t.name, ...t.aliases].includes(label),
		)
		if (matches.length !== 1)
			throw new Error(`unknown_source_competitor:${sport}:${label}`)
		return matches[0]
	}
	const fixes = parseCsv(
		await fs.readFile(path.join(audit, 'fixes.csv'), 'utf8'),
	)
	const needed = new Map()
	for (const r of fixes) {
		const ts = [
			resolve(r.sport, r.team_a),
			resolve(r.sport, r.team_b),
		].sort((a, b) => (a.id < b.id ? -1 : 1))
		if (ts[0].id === ts[1].id || r.reuse_candidates) continue
		needed.set(`${r.sport}:${ts.map((t) => t.id).join(':')}`, {
			sport: r.sport,
			teams: ts.map((t) => t.id),
			teamNames: ts.map((t) => t.name),
		})
	}
	needed.set('nfl:bears:commanders', {
		sport: 'nfl',
		teams: ['bears', 'commanders'],
		teamNames: ['Chicago Bears', 'Washington Commanders'],
	})
	if (needed.size !== 102) throw new Error('unexpected_source_worklist')
	const events = new Map(),
		scheduleAttempts = []
	// Four completed calendar years cover the NFL's interconference rotation.
	const scoreboards = [2025, 2024, 2023, 2022].map((year) => ({
		sport: 'nfl',
		type: 'football',
		dates: String(year),
	}))
	scoreboards.push({ sport: 'nba', type: 'basketball', dates: '20230130' })
	for (const query of scoreboards) {
		const url = `https://site.api.espn.com/apis/site/v2/sports/${query.type}/${query.sport}/scoreboard?dates=${query.dates}&limit=1000`
		const attempt = { url, sport: query.sport, dates: query.dates }
		try {
			const bytes = await fetchBytes(url),
				data = JSON.parse(bytes)
			attempt.sha256 = sha256(bytes)
			attempt.eventCount = data.events?.length ?? 0
			attempt.status = 'ok'
			await fs.writeFile(
				path.join(
					evidence,
					`scoreboard-${query.sport}-${query.dates}.json`,
				),
				bytes,
				{ flag: 'wx' },
			)
			for (const event of data.events ?? []) {
				const competitors = event.competitions?.[0]?.competitors
				if (competitors?.length !== 2) continue
				// Resolve the actual ESPN team identity, never a guessed image filename.
				// Pro Bowl AFC/NFC selections are not franchise matchups.
				if (
					competitors.some(
						(c) =>
							!registry[query.sport].some((t) =>
								[t.id, t.name, ...t.aliases].includes(
									c.team.displayName,
								),
							),
					)
				) {
					attempt.skippedNonFranchiseEvents =
						(attempt.skippedNonFranchiseEvents ?? 0) + 1
					continue
				}
				const ts = competitors
					.map((c) => resolve(query.sport, c.team.displayName))
					.sort((a, b) => (a.id < b.id ? -1 : 1))
				const key = `${query.sport}:${ts.map((t) => t.id).join(':')}`
				if (!needed.has(key)) continue
				if (!events.has(key)) events.set(key, [])
				events.get(key).push({
					id: event.id,
					date: event.date,
					name: event.name,
					metadataUrl: url,
					sport: query.sport,
					type: query.type,
					competitors: competitors.map((c) => ({
						espnTeamId: c.team.id,
						name: c.team.displayName,
						canonicalId: resolve(query.sport, c.team.displayName)
							.id,
						homeAway: c.homeAway,
					})),
				})
			}
		} catch (error) {
			attempt.status = 'failed'
			attempt.reason = error.message
		}
		scheduleAttempts.push(attempt)
		console.log(
			`scoreboard ${query.sport} ${query.dates}: ${attempt.status} ${attempt.eventCount ?? 0} events`,
		)
	}
	const sources = []
	for (const [pairKey, pair] of [...needed].sort(([a], [b]) =>
		a < b ? -1 : 1,
	)) {
		const source = {
			pairKey,
			...pair,
			googleQueryUrl: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(pair.teamNames.join(' ') + ' ESPN matchup logos')}`,
			discovery: {
				source: 'Free public image-search observed ESPN stitcher family',
				directGoogleStatus:
					'blocked: unusual-traffic CAPTCHA; no bypass attempted',
				evidence: 'assets/repair-evidence/search/google-results.png',
				htmlEvidence:
					'assets/repair-evidence/search/google-rendered.html',
				representative:
					'https://s.secure.espncdn.com/stitcher/sports/football/nfl/events/321223022.png?templateId=espn.com.share.1',
			},
			attempts: [],
			status: 'unavailable',
			approval: 'pending',
		}
		const candidates = (events.get(pairKey) ?? []).sort(
			(a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
		)
		for (const event of candidates.slice(0, 3)) {
			const url = `https://s.secure.espncdn.com/stitcher/sports/${event.type}/${event.sport}/events/${event.id}.png?templateId=espn.com.share.1`
			const attempt = {
				imageUrl: url,
				eventId: event.id,
				metadataUrl: event.metadataUrl,
			}
			try {
				const bytes = await fetchBytes(url),
					metadata = await sharp(bytes).metadata()
				if (
					metadata.format !== 'png' ||
					metadata.width !== 400 ||
					metadata.height !== 400
				)
					throw new Error('nonmatching_source_dimensions_or_format')
				const file = `${pairKey.replaceAll(':', '-')}.png`
				await fs.writeFile(path.join(output, file), bytes, {
					flag: 'wx',
				})
				Object.assign(source, {
					status: 'recovered',
					file,
					sha256: sha256(bytes),
					bytes: bytes.length,
					width: 400,
					height: 400,
					mime: 'image/png',
					imageUrl: url,
					sourcePage: `https://www.espn.com/${event.sport}/game/_/gameId/${event.id}`,
					eventId: event.id,
					eventDate: event.date,
					eventName: event.name,
					metadataUrl: event.metadataUrl,
					competitors: event.competitors,
					recoveredAt: new Date().toISOString(),
				})
				attempt.status = 'ok'
				source.attempts.push(attempt)
				break
			} catch (error) {
				attempt.status = 'failed'
				attempt.reason = error.message
				source.attempts.push(attempt)
			}
		}
		if (!candidates.length)
			source.attempts.push({
				status: 'unavailable',
				reason: 'No verified two-competitor event for this canonical pair in bounded public scoreboard queries.',
				metadataQueries: scheduleAttempts.map((a) => a.url),
			})
		sources.push(source)
		console.log(`${pairKey}: ${source.status}`)
	}
	const provenance = {
		schemaVersion: 1,
		teamsRevision: sha256(JSON.stringify(registry)),
		scheduleAttempts,
		counts: {
			needed: needed.size,
			recovered: sources.filter((s) => s.status === 'recovered').length,
			unavailable: sources.filter((s) => s.status === 'unavailable')
				.length,
		},
		sources,
	}
	await save(path.join(output, 'provenance.json'), provenance)
	await save(path.join(evidence, 'source-recovery.json'), provenance)
	return provenance.counts
}

export async function restoreOriginals(provenanceFile, output) {
	const provenance = JSON.parse(await fs.readFile(provenanceFile, 'utf8'))
	output = path.resolve(output)
	try {
		if ((await fs.readdir(output)).length)
			throw new Error('nonempty_source_output')
	} catch (error) {
		if (error.code !== 'ENOENT') throw error
	}
	await fs.mkdir(output, { recursive: true })
	if ((await fs.realpath(output)) !== output)
		throw new Error('symlink_source_destination')
	for (const source of provenance.sources) {
		if (source.status !== 'recovered') continue
		if (
			!/^(nba|nfl)-[a-z0-9-]+\.png$/.test(source.file) ||
			!/^https:\/\/s\.secure\.espncdn\.com\/stitcher\/sports\/(football\/nfl|basketball\/nba)\/events\/\d+\.png\?templateId=espn\.com\.share\.1$/.test(
				source.imageUrl,
			)
		)
			throw new Error('unsafe_pinned_source')
		const bytes = await fetchBytes(source.imageUrl)
		if (sha256(bytes) !== source.sha256)
			throw new Error(`pinned_source_hash_drift:${source.pairKey}`)
		await fs.writeFile(path.join(output, source.file), bytes, {
			flag: 'wx',
		})
	}
	await save(path.join(output, 'provenance.json'), provenance)
	return {
		restored: provenance.sources.filter((s) => s.status === 'recovered')
			.length,
	}
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const args = process.argv.slice(2),
		options = {}
	if (args[0] === '--restore') {
		if (args.length !== 4 || args[2] !== '--output')
			throw new Error(
				'Usage: --restore <pinned-provenance> --output <empty-cache>',
			)
		console.log(JSON.stringify(await restoreOriginals(args[1], args[3])))
	} else {
		for (let i = 0; i < args.length; i += 2) {
			if (
				!['--audit', '--output', '--evidence'].includes(args[i]) ||
				!args[i + 1] ||
				args[i + 1].startsWith('--')
			)
				throw new Error('invalid_source_arguments')
			const key = args[i].slice(2)
			if (key in options) throw new Error('duplicate_source_argument')
			options[key] = args[i + 1]
		}
		if (['audit', 'output', 'evidence'].some((k) => !options[k]))
			throw new Error('missing_source_arguments')
		console.log(JSON.stringify(await recover(options)))
	}
}
