import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pairKey, resolveTeam } from './image-team-aliases.js'
import {
	ManifestValidationError,
	type MatchupImageEntry,
	validateImageBytes,
	validateMatchupManifest,
} from './matchup-image-schema.js'

export interface MatchupImageRequest {
	sport: string
	awayTeam: string
	homeTeam: string
}
export type MatchupImageReason =
	| 'unknown_sport'
	| 'unknown_team'
	| 'self_matchup'
	| 'manifest_unavailable'
	| 'manifest_schema'
	| 'manifest_coverage'
	| 'manifest_approval'
	| 'manifest_release'
	| 'unapproved_pair'
	| 'unsafe_path'
	| 'asset_unavailable'
	| 'asset_hash'
	| 'asset_signature'
export interface MatchupImageDiagnostic {
	component: 'matchup-images'
	event: 'matchup.image.unavailable'
	reason: MatchupImageReason
}
export const MATCHUP_ASSETS_ROOT = fileURLToPath(
	new URL('../../../../assets/matchupimages/', import.meta.url),
)
class UnsafePathError extends Error {}

/** Check every asset component; never follow manifest, directory, or image symlinks. */
async function readSafeFile(root: string, relative: string): Promise<Buffer> {
	const rootStat = await fs.lstat(root)
	if ((await fs.realpath(root)) !== root) throw new UnsafePathError()
	if (rootStat.isSymbolicLink() || !rootStat.isDirectory())
		throw new UnsafePathError()
	let target = root
	const parts = relative.split('/')
	for (let index = 0; index < parts.length; index++) {
		target = path.join(target, parts[index])
		const stat = await fs.lstat(target)
		if (
			stat.isSymbolicLink() ||
			(index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile())
		)
			throw new UnsafePathError()
	}
	const handle = await fs.open(
		target,
		constants.O_RDONLY | constants.O_NOFOLLOW,
	)
	try {
		if (!(await handle.stat()).isFile()) throw new UnsafePathError()
		return await handle.readFile()
	} finally {
		await handle.close()
	}
}

export function createMatchupImageResolver(options: {
	assetsRoot: string
	report?: (diagnostic: MatchupImageDiagnostic) => void
}) {
	const root = path.resolve(options.assetsRoot)
	const reported = new Set<MatchupImageReason>()
	const report = (reason: MatchupImageReason) => {
		// At most one record per finite reason per resolver lifetime; no raw input or stack floods.
		if (reported.has(reason)) return
		reported.add(reason)
		const diagnostic: MatchupImageDiagnostic = {
			component: 'matchup-images',
			event: 'matchup.image.unavailable',
			reason,
		}
		try {
			;(
				options.report ??
				((value) => console.warn(JSON.stringify(value)))
			)(diagnostic)
		} catch {
			console.warn(JSON.stringify(diagnostic))
		}
	}
	// Eagerly initialize once so a broken release is visible even before the first supported matchup.
	const manifest = (async (): Promise<Map<
		string,
		MatchupImageEntry
	> | null> => {
		try {
			const bytes = await readSafeFile(root, 'manifest.json')
			const parsed = validateMatchupManifest(
				JSON.parse(bytes.toString('utf8')),
			)
			return new Map(
				parsed.entries.map((entry) => [entry.pairKey, entry]),
			)
		} catch (error) {
			report(
				error instanceof ManifestValidationError
					? error.reason
					: error instanceof UnsafePathError
						? 'unsafe_path'
						: error instanceof SyntaxError
							? 'manifest_schema'
							: 'manifest_unavailable',
			)
			return null
		}
	})()
	return async ({
		sport,
		awayTeam,
		homeTeam,
	}: MatchupImageRequest): Promise<Buffer | null> => {
		const normalizedSport =
			typeof sport === 'string' ? sport.trim().toLowerCase() : ''
		if (normalizedSport !== 'nba' && normalizedSport !== 'nfl') {
			report('unknown_sport')
			return null
		}
		const away = resolveTeam(normalizedSport, awayTeam)
		const home = resolveTeam(normalizedSport, homeTeam)
		if (!away || !home) {
			report('unknown_team')
			return null
		}
		if (away === home) {
			report('self_matchup')
			return null
		}
		const entries = await manifest
		if (!entries) return null
		const entry = entries.get(pairKey(normalizedSport, away, home))
		if (!entry || !entry.orderIndependent) {
			report('unapproved_pair')
			return null
		}
		try {
			const bytes = await readSafeFile(root, entry.path)
			if (
				createHash('sha256').update(bytes).digest('hex') !==
				entry.sha256
			) {
				report('asset_hash')
				return null
			}
			if (!validateImageBytes(bytes, entry)) {
				report('asset_signature')
				return null
			}
			return bytes
		} catch (error) {
			report(
				error instanceof UnsafePathError
					? 'unsafe_path'
					: 'asset_unavailable',
			)
			return null
		}
	}
}
export const resolveMatchupImage = createMatchupImageResolver({
	assetsRoot: MATCHUP_ASSETS_ROOT,
})
