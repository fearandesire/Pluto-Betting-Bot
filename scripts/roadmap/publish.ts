import { createHmac } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

// Keep private tracker exports under scripts/roadmap/exports/; .gitignore excludes them.

export const ROADMAP_LANES = ['Now', 'Next', 'Later', 'Shipped'] as const
const SHIPPED_WINDOW_DAYS = 90
const DAY_IN_MS = 24 * 60 * 60 * 1000
const OPAQUE_ID_PATTERN = /^[a-f0-9]{16}$/u
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

export type RoadmapLane = (typeof ROADMAP_LANES)[number]

export interface RoadmapItem {
	trackerId?: unknown
	title: string
	description?: string | null
	publicSummary?: unknown
	labels?: unknown
	labelNames?: unknown
	status?: unknown
	state?: unknown
	lane?: unknown
	column?: unknown
	milestoneId?: unknown
	milestone?: unknown
	completedAt?: unknown
	shippedAt?: unknown
	closedAt?: unknown
	[key: string]: unknown
}

export interface FilterOptions {
	idSecret: string
	milestoneAllowlist: ReadonlySet<string>
	tombstones?: ReadonlySet<string>
	now?: Date
}

export interface PublishOptions {
	env?: Record<string, string | undefined>
	milestoneAllowlist?: ReadonlySet<string>
	tombstones?: ReadonlySet<string>
	now?: Date
}

const STATUS_TO_LANE: ReadonlyMap<string, RoadmapLane> = new Map([
	['now', 'Now'],
	['next', 'Next'],
	['later', 'Later'],
	['shipped', 'Shipped'],
	['todo', 'Later'],
	['backlog', 'Later'],
	['in progress', 'Now'],
	['done', 'Shipped'],
])

function extractItems(input: unknown): RoadmapItem[] {
	if (Array.isArray(input)) {
		return input as RoadmapItem[]
	}

	if (!input || typeof input !== 'object') {
		throw new Error('Unsupported roadmap export shape')
	}

	const record = input as Record<string, unknown>
	for (const key of ['items', 'issues']) {
		if (Array.isArray(record[key])) {
			return record[key] as RoadmapItem[]
		}
	}

	if (record.data && typeof record.data === 'object') {
		const data = record.data as Record<string, unknown>
		for (const key of ['items', 'issues']) {
			if (Array.isArray(data[key])) {
				return data[key] as RoadmapItem[]
			}
		}
	}

	throw new Error('Unsupported roadmap export shape')
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function assertIdSecret(secret: unknown): asserts secret is string {
	if (typeof secret !== 'string' || secret.length < 32) {
		throw new Error('ROADMAP_ID_SECRET must be at least 32 characters')
	}
}

export function derivePublicId(trackerId: string, secret: string): string {
	assertIdSecret(secret)
	if (!trackerId.trim()) {
		throw new Error('Roadmap item is missing trackerId')
	}

	return createHmac('sha256', secret).update(trackerId, 'utf8').digest('hex').slice(0, 16)
}

function getMilestoneId(item: RoadmapItem): string | undefined {
	const directId = asString(item.milestoneId)
	if (directId) {
		return directId
	}

	if (typeof item.milestone === 'string') {
		return asString(item.milestone)
	}

	if (item.milestone && typeof item.milestone === 'object') {
		const milestone = item.milestone as Record<string, unknown>
		return asString(milestone.uuid) ?? asString(milestone.id)
	}

	return undefined
}

function getLabels(item: RoadmapItem): string[] {
	const labels = item.labels ?? item.labelNames
	if (!Array.isArray(labels)) {
		return []
	}

	return labels.flatMap((label) => {
		const value = typeof label === 'string' ? label : label && typeof label === 'object' ? (label as Record<string, unknown>).name : undefined
		const normalized = asString(value)?.toLowerCase()
		return normalized ? [normalized] : []
	})
}

function getStatusName(value: unknown): string | undefined {
	if (typeof value === 'string') {
		return value.trim().toLowerCase()
	}
	if (value && typeof value === 'object') {
		return asString((value as Record<string, unknown>).name)?.toLowerCase()
	}
	return undefined
}

function getLane(item: RoadmapItem): RoadmapLane | undefined {
	for (const value of [item.status, item.state, item.lane, item.column]) {
		const status = getStatusName(value)
		const lane = status ? STATUS_TO_LANE.get(status) : undefined
		if (lane) {
			return lane
		}
	}
	return undefined
}

function assertRecognizableStatuses(items: readonly RoadmapItem[]): void {
	if (items.length > 0 && !items.some((item) => getLane(item))) {
		throw new Error('Roadmap export has no recognizable statuses')
	}
}

function parseUtcDate(value: unknown): number | undefined {
	const text = asString(value)
	if (!text) {
		return undefined
	}

	let normalized = text
	if (/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
		normalized += 'T00:00:00Z'
	} else if (
		/^\d{4}-\d{2}-\d{2}T/u.test(normalized) &&
		!/(?:Z|[+-]\d{2}:?\d{2})$/iu.test(normalized)
	) {
		normalized += 'Z'
	}

	const timestamp = Date.parse(normalized)
	return Number.isNaN(timestamp) ? undefined : timestamp
}

function isRecentlyShipped(item: RoadmapItem, now: Date): boolean {
	const shippedTime = parseUtcDate(item.shippedAt ?? item.completedAt ?? item.closedAt)
	if (shippedTime === undefined) {
		return false
	}

	const age = now.getTime() - shippedTime
	return age >= 0 && age <= SHIPPED_WINDOW_DAYS * DAY_IN_MS
}

export function parseMilestoneAllowlist(value: string | undefined): Set<string> {
	return new Set(
		(value ?? '')
			.split(/[\s,]+/u)
			.map((milestone) => milestone.trim())
			.filter(Boolean),
	)
}

export function filterPublishableItems(
	input: unknown,
	options: FilterOptions,
): Array<RoadmapItem & { publicId: string; lane: RoadmapLane }> {
	assertIdSecret(options.idSecret)
	const items = extractItems(input)
	assertRecognizableStatuses(items)
	const now = options.now ?? new Date()
	const tombstones = options.tombstones ?? new Set<string>()

	return items.flatMap((item) => {
		const lane = getLane(item)
		const trackerId = asString(item.trackerId)
		const milestoneId = getMilestoneId(item)
		if (
			!lane ||
			!trackerId ||
			!getLabels(item).includes('public') ||
			!milestoneId ||
			!options.milestoneAllowlist.has(milestoneId) ||
			(lane === 'Shipped' && !isRecentlyShipped(item, now))
		) {
			return []
		}

		const publicId = derivePublicId(trackerId, options.idSecret)
		if (tombstones.has(publicId)) {
			return []
		}

		return [{ ...item, lane, publicId }]
	})
}

function collapseWhitespace(value: string): string {
	return value.replace(/\s+/gu, ' ').trim()
}

function escapeMarkup(value: string): string {
	return collapseWhitespace(value)
		.replace(/&/gu, '&amp;')
		.replace(/</gu, '&lt;')
		.replace(/>/gu, '&gt;')
		.replace(/"/gu, '&quot;')
		.replace(/'/gu, '&#39;')
		.replace(/[\\`*_{}[\]()#+.!|>~-]/gu, '\\$&')
}

function renderItem(item: RoadmapItem): string {
	const title = escapeMarkup(asString(item.title) ?? 'Unspecified roadmap item')
	const summary = asString(item.publicSummary)
	return `- ${[title, summary ? escapeMarkup(summary) : ''].filter(Boolean).join(' - ')}`
}

const RELATIVE_LINK_PATTERN = new RegExp(String.raw`\]\s*\((?:/|\.{1,2}/)`, 'u')

const UNSAFE_MARKDOWN_PATTERNS = [
	/\b[A-Z]{1,10}-?\d+\b/iu,
	/(?:https?:\/\/|ftp:\/\/|www\.)[^\s]+/iu,
	/\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/iu,
	/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/iu,
	/(^|\s)@[\w-]+/u,
	/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/iu,
	/\b(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,4}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{8})\b/u,
	/\bQ[1-4]\s+\d{4}\b/iu,
	/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?\b/iu,
	/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/iu,
	/\\\]\s*\\\((?:\/|\.{1,2}\/)/u,
	RELATIVE_LINK_PATTERN,
]

function assertSafeMarkdown(markdown: string): void {
	const unescaped = markdown.replace(/\\/gu, '')
	if (UNSAFE_MARKDOWN_PATTERNS.some((pattern) => pattern.test(unescaped))) {
		throw new Error('Generated roadmap contains unsafe public content')
	}
}

export function renderRoadmap(items: readonly RoadmapItem[]): string {
	const sections = ROADMAP_LANES.map((lane) => {
		const entries = items
			.filter((item) => getLane(item) === lane)
			.sort((left, right) => (asString(left.title) ?? '').localeCompare(asString(right.title) ?? ''))
			.map(renderItem)

		return [`## ${lane}`, ...(entries.length > 0 ? entries : ['- None currently listed'])].join('\n')
	})

	const markdown = `# Public Roadmap\n\n${sections.join('\n\n')}\n`
	assertSafeMarkdown(markdown)
	return markdown
}

export function publishRoadmap(input: unknown, options: PublishOptions = {}): string {
	const env = options.env ?? process.env
	const idSecret = env.ROADMAP_ID_SECRET
	assertIdSecret(idSecret)
	const milestoneAllowlist =
		options.milestoneAllowlist ?? parseMilestoneAllowlist(env.ROADMAP_MILESTONE_ALLOWLIST)

	return renderRoadmap(
		filterPublishableItems(input, {
			idSecret,
			milestoneAllowlist,
			now: options.now,
			tombstones: options.tombstones,
		}),
	)
}

export function readTombstones(input: unknown): Set<string> {
	if (!Array.isArray(input)) {
		throw new Error('roadmap-tombstones.json must be an array of opaque ids')
	}

	const tombstones = new Set<string>()
	for (const value of input) {
		if (typeof value !== 'string' || !OPAQUE_ID_PATTERN.test(value)) {
			throw new Error('roadmap tombstones must contain 16-character lowercase hex ids')
		}
		tombstones.add(value)
	}
	return tombstones
}

export function publishFiles({
	inputPath,
	outputPath,
	tombstonesPath,
}: {
	inputPath: string
	outputPath: string
	tombstonesPath: string
}): void {
	const input = JSON.parse(readFileSync(inputPath, 'utf8')) as unknown
	const tombstones = readTombstones(JSON.parse(readFileSync(tombstonesPath, 'utf8')))
	const markdown = publishRoadmap(input, { tombstones })
	writeFileSync(outputPath, markdown)
}

export function runCli(args: readonly string[] = process.argv.slice(2)): void {
	const [inputPath, outputPath = 'docs/ROADMAP.md', tombstonesPath = 'roadmap-tombstones.json'] = args
	if (!inputPath) {
		throw new Error('Usage: publish.ts <input-path> [output-path] [tombstones-path]')
	}

	publishFiles({ inputPath, outputPath, tombstonesPath })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	runCli()
}
