import { createHash } from 'node:crypto'
import { z } from 'zod'
import { pairKey, TEAM_REGISTRY, TEAMS_REVISION } from './image-team-aliases.js'

const hash = z.string().regex(/^[a-f0-9]{64}$/u)
const nonempty = z
	.string()
	.min(1)
	.refine((value) => value.trim() === value)
/** POSIX relative asset paths only; neither platform separators nor traversal. */
export function isSafeAssetPath(value: string): boolean {
	return (
		typeof value === 'string' &&
		/^[a-zA-Z0-9_.\/-]+$/u.test(value) &&
		!value.startsWith('/') &&
		value
			.split('/')
			.every((part) => part !== '' && part !== '.' && part !== '..')
	)
}
const relativePath = z.string().refine(isSafeAssetPath)
const entrySchema = z.strictObject({
	pairKey: nonempty,
	sport: z.enum(['nba', 'nfl']),
	teams: z.tuple([nonempty, nonempty]),
	path: relativePath,
	sha256: hash,
	width: z.number().int().positive().max(16384),
	height: z.number().int().positive().max(16384),
	mime: z.enum(['image/png', 'image/jpeg']),
	orderIndependent: z.literal(true),
	approval: z.strictObject({
		teams: z.tuple([nonempty, nonempty]),
		sha256: hash,
		evidence: nonempty,
	}),
	provenance: z.strictObject({
		kind: z.enum(['generated', 'sourced', 'audit', 'reuse']),
		auditId: nonempty,
		sourcePath: nonempty,
	}),
})
const manifestSchema = z.strictObject({
	schemaVersion: z.literal(1),
	releaseId: hash,
	teamsRevision: z.literal(TEAMS_REVISION),
	entries: z.array(entrySchema).length(931),
})
export type MatchupImageEntry = z.infer<typeof entrySchema>
export type MatchupImageManifest = z.infer<typeof manifestSchema>
export type ManifestValidationReason =
	| 'manifest_schema'
	| 'manifest_coverage'
	| 'manifest_approval'
	| 'manifest_release'
export class ManifestValidationError extends Error {
	readonly reason: ManifestValidationReason
	constructor(reason: ManifestValidationReason) {
		super(reason)
		this.name = 'ManifestValidationError'
		this.reason = reason
	}
}
export function computeMatchupReleaseId(
	manifest: Pick<MatchupImageManifest, 'teamsRevision' | 'entries'>,
): string {
	return createHash('sha256')
		.update(
			JSON.stringify({
				teamsRevision: manifest.teamsRevision,
				entries: [...manifest.entries].sort((a, b) =>
					a.pairKey.localeCompare(b.pairKey),
				),
			}),
		)
		.digest('hex')
}
/** Shared by the runtime and the offline full-decoding release validator. */
export function validateMatchupManifest(value: unknown): MatchupImageManifest {
	const parsed = manifestSchema.safeParse(value)
	if (!parsed.success) throw new ManifestValidationError('manifest_schema')
	const manifest = parsed.data
	const keys = new Set<string>()
	const paths = new Set<string>()
	let previous = ''
	for (const entry of manifest.entries) {
		let expected: string
		try {
			expected = pairKey(entry.sport, entry.teams[0], entry.teams[1])
		} catch {
			throw new ManifestValidationError('manifest_coverage')
		}
		if (
			entry.pairKey !== expected ||
			entry.teams[0] >= entry.teams[1] ||
			keys.has(expected) ||
			paths.has(entry.path) ||
			entry.pairKey <= previous ||
			!entry.path.startsWith(`${entry.sport}/`)
		)
			throw new ManifestValidationError('manifest_coverage')
		const approval = entry.approval
		if (
			approval.sha256 !== entry.sha256 ||
			approval.teams[0] !== entry.teams[0] ||
			approval.teams[1] !== entry.teams[1] ||
			/pending|placeholder|unreviewed|todo/iu.test(approval.evidence) ||
			!(
				isSafeAssetPath(approval.evidence) ||
				/^audit:[a-zA-Z0-9_.\/-]+$/u.test(approval.evidence)
			)
		) {
			throw new ManifestValidationError('manifest_approval')
		}
		keys.add(expected)
		paths.add(entry.path)
		previous = entry.pairKey
	}
	for (const sport of ['nba', 'nfl'] as const) {
		for (const a of TEAM_REGISTRY[sport])
			for (const b of TEAM_REGISTRY[sport]) {
				if (a.id < b.id && !keys.has(pairKey(sport, a.id, b.id)))
					throw new ManifestValidationError('manifest_coverage')
			}
	}
	if (
		manifest.releaseId !==
		computeMatchupReleaseId(value as MatchupImageManifest)
	)
		throw new ManifestValidationError('manifest_release')
	return manifest
}

/** Cheap signature/structure/dimension guard; full decoding belongs to release validation. */
export function validateImageBytes(
	bytes: Buffer,
	entry: Pick<MatchupImageEntry, 'mime' | 'width' | 'height'>,
): boolean {
	if (entry.mime === 'image/png') {
		if (
			bytes.length < 45 ||
			!bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
		)
			return false
		let offset = 8
		let hasData = false
		while (offset + 12 <= bytes.length) {
			const length = bytes.readUInt32BE(offset)
			const type = bytes.toString('ascii', offset + 4, offset + 8)
			if (offset + length + 12 > bytes.length) return false
			if (
				offset === 8 &&
				(type !== 'IHDR' ||
					length !== 13 ||
					bytes.readUInt32BE(offset + 8) !== entry.width ||
					bytes.readUInt32BE(offset + 12) !== entry.height)
			)
				return false
			if (type === 'IDAT' && length > 0) hasData = true
			if (type === 'IEND')
				return length === 0 && hasData && offset + 12 === bytes.length
			offset += length + 12
		}
		return false
	}
	if (
		bytes.length < 12 ||
		bytes[0] !== 0xff ||
		bytes[1] !== 0xd8 ||
		bytes[bytes.length - 2] !== 0xff ||
		bytes[bytes.length - 1] !== 0xd9
	)
		return false
	let offset = 2
	let dimensionsMatch = false
	while (offset + 4 <= bytes.length) {
		if (bytes[offset++] !== 0xff) return false
		while (bytes[offset] === 0xff) offset++
		const marker = bytes[offset++]
		if (marker === 0xda) return dimensionsMatch // Start of scan; compressed bytes are hash-bound.
		if (offset + 2 > bytes.length) return false
		const length = bytes.readUInt16BE(offset)
		if (length < 2 || offset + length > bytes.length) return false
		if (
			marker >= 0xc0 &&
			marker <= 0xcf &&
			![0xc4, 0xc8, 0xcc].includes(marker)
		) {
			if (length < 8) return false
			dimensionsMatch =
				bytes.readUInt16BE(offset + 3) === entry.height &&
				bytes.readUInt16BE(offset + 5) === entry.width
		}
		offset += length
	}
	return false
}
