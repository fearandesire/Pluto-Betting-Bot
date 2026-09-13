import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export const ROADMAP_LANES = ['Now', 'Next', 'Later', 'Shipped'] as const
const SHIPPED_WINDOW_DAYS = 90
const DAY_IN_MS = 24 * 60 * 60 * 1000

export type RoadmapLane = (typeof ROADMAP_LANES)[number]

export interface RoadmapItem {
	publicId?: string
	id?: string
	title: string
	description?: string | null
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
	milestoneAllowlist: ReadonlySet<string>
	tombstones?: ReadonlySet<string>
	now?: Date
}

export interface PublishOptions extends Partial<FilterOptions> {
	env?: Record<string, string | undefined>
}

function asItems(input: unknown): RoadmapItem[] {
	if (Array.isArray(input)) {
		return input as RoadmapItem[]
	}

	if (!input || typeof input !== 'object') {
		return []
	}

	const record = input as Record<string, unknown>
	for (const key of ['items', 'issues', 'data']) {
		const value = record[key]
		if (Array.isArray(value)) {
			return value as RoadmapItem[]
		}
		if (value && typeof value === 'object') {
			const nested = asItems(value)
			if (nested.length > 0) {
				return nested
			}
		}
	}

	return []
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim() ? value.trim() : undefined
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

function getPublicId(item: RoadmapItem): string | undefined {
	return asString(item.publicId) ?? asString(item.opaquePublicId) ?? asString(item.id)
}

function getLabels(item: RoadmapItem): string[] {
	const labels = item.labels ?? item.labelNames
	if (!Array.isArray(labels)) {
		return []
	}

	return labels.flatMap((label) => {
		if (typeof label === 'string') {
			return [label.toLowerCase()]
		}
		if (label && typeof label === 'object') {
			const name = asString((label as Record<string, unknown>).name)
			return name ? [name.toLowerCase()] : []
		}
		return []
	})
}

function getLane(item: RoadmapItem): RoadmapLane | undefined {
	const value = asString(item.status ?? item.state ?? item.lane ?? item.column)?.toLowerCase()
	return ROADMAP_LANES.find((lane) => lane.toLowerCase() === value)
}

function isRecentlyShipped(item: RoadmapItem, now: Date): boolean {
	const shippedAt = asString(item.shippedAt ?? item.completedAt ?? item.closedAt)
	if (!shippedAt) {
		return false
	}

	const shippedTime = Date.parse(shippedAt)
	if (Number.isNaN(shippedTime)) {
		return false
	}

	const age = now.getTime() - shippedTime
	return age >= 0 && age <= SHIPPED_WINDOW_DAYS * DAY_IN_MS
}

function isPublishableLane(item: RoadmapItem, now: Date): boolean {
	const lane = getLane(item)
	return lane !== undefined && (lane !== 'Shipped' || isRecentlyShipped(item, now))
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
): RoadmapItem[] {
	const now = options.now ?? new Date()
	const tombstones = options.tombstones ?? new Set<string>()

	return asItems(input).filter((item) => {
		const publicId = getPublicId(item)
		return (
			getLabels(item).includes('public') &&
			publicId !== undefined &&
			!tombstones.has(publicId) &&
			getMilestoneId(item) !== undefined &&
			options.milestoneAllowlist.has(getMilestoneId(item) as string) &&
			isPublishableLane(item, now)
		)
	})
}

function stripPrivateMetadata(value: string): string {
	return value
		.replace(/\[[^\]]+\]\(https?:\/\/[^)]+\)/giu, '')
		.replace(/https?:\/\/\S+/giu, '')
		.replace(/\b[A-Z][A-Z0-9]+-\d+\b/gu, '')
		.replace(/#\d+\b/gu, '')
		.replace(/\b\d{4}-\d{2}-\d{2}(?:T\S+)?\b/gu, '')
		.replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/gu, '')
		.replace(
			/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:,\s*\d{4})?\b/giu,
			'',
		)
		.replace(/\b(?:assigned to|assignee|owner|dri)\s*:\s*[^.;\n]+[.;]?/giu, '')
		.replace(/\b(?:assigned to|owned by)\s+[^.;\n]+[.;]?/giu, '')
		.replace(/\b(?:completed|shipped|released)\s+on\s+[^.;\n]+[.;]?/giu, '')
		.replace(/\s{2,}/gu, ' ')
		.replace(/\s+([.,;])/gu, '$1')
		.trim()
}

export function renderRoadmap(items: readonly RoadmapItem[]): string {
	const sections = ROADMAP_LANES.map((lane) => {
		const entries = items
			.filter((item) => getLane(item) === lane)
			.map((item) => {
				const title = stripPrivateMetadata(item.title)
				const description = asString(item.description)
					? stripPrivateMetadata(item.description as string)
					: ''
				const text = [title, description].filter(Boolean).join(' - ')
				return `- ${text || 'Unspecified roadmap item'}`
			})

		return [`## ${lane}`, ...(entries.length > 0 ? entries : ['- None currently listed'])].join('\n')
	})

	return `# Public Roadmap\n\n${sections.join('\n\n')}\n`
}

export function publishRoadmap(input: unknown, options: PublishOptions = {}): string {
	const env = options.env ?? process.env
	const milestoneAllowlist =
		options.milestoneAllowlist ?? parseMilestoneAllowlist(env.ROADMAP_MILESTONE_ALLOWLIST)

	return renderRoadmap(
		filterPublishableItems(input, {
			milestoneAllowlist,
			now: options.now,
			tombstones: options.tombstones,
		}),
	)
}

export function readTombstones(input: unknown): Set<string> {
	if (Array.isArray(input)) {
		return new Set(input.filter((value): value is string => typeof value === 'string'))
	}

	if (input && typeof input === 'object') {
		const values = (input as Record<string, unknown>).ids
		if (Array.isArray(values)) {
			return readTombstones(values)
		}
	}

	return new Set()
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
	writeFileSync(outputPath, publishRoadmap(input, { tombstones }))
}

function runCli(): void {
	const [inputPath = 'scripts/roadmap/fixtures/export.sample.json', outputPath = 'docs/ROADMAP.md', tombstonesPath = 'roadmap-tombstones.json'] = process.argv.slice(2)
	publishFiles({ inputPath, outputPath, tombstonesPath })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	runCli()
}
