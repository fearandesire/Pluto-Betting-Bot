import type { PropDto, PropOutcomeDetailDto } from '@pluto-khronos/api-client'

/** One page fits Discord's 25-option string select. */
export const PROP_PICKER_PAGE_SIZE = 25

/** The server caps a curated slate at 25 outcome pairs. */
export const PROP_PICKER_MAX_SELECTED = 25

export type PropPickerFilters = {
	game: string
	category: string
	player: string
}

export const EMPTY_PROP_PICKER_FILTERS: PropPickerFilters = {
	game: '',
	category: '',
	player: '',
}

export type PropPickerPrice = {
	over: number
	under: number
}

/** One postable pair, keyed the same way Khronos pairs a curated post. */
export type PropPickerPair = {
	key: string
	eventId: string
	game: string
	commenceTime: string
	player: string | null
	marketKey: string
	line: number | null
	overUuid: string
	underUuid: string
	overPrice: number
	underPrice: number
}

export type PropPickerPage = {
	items: PropPickerPair[]
	page: number
	pages: number
	total: number
}

export type PropPickerPriceChange = {
	key: string
	label: string
	before: PropPickerPrice
	after: PropPickerPrice
}

const sideName = (outcome: PropOutcomeDetailDto) => outcome.name.toLowerCase()

/**
 * Split each event-and-market group from `GET /props/available` into real
 * Over/Under pairs. The key matches the server's curated-post key: event,
 * market, player (description with the over/under fallback) and line.
 */
export function buildPropPickerPairs(props: PropDto[]): PropPickerPair[] {
	const pairs: PropPickerPair[] = []
	const seen = new Set<string>()
	for (const prop of props) {
		for (const [over, under] of pairSides(prop.outcomes)) {
			const player = over.description ?? under.description ?? null
			const line = over.point ?? under.point ?? null
			const key = [
				prop.event_id,
				prop.market_key,
				player ?? '',
				line ?? '',
			].join('|')
			if (seen.has(key)) continue
			seen.add(key)
			pairs.push({
				key,
				eventId: prop.event_id,
				game: `${prop.event_context.home_team} vs ${prop.event_context.away_team}`,
				commenceTime: prop.event_context.commence_time,
				player,
				marketKey: prop.market_key,
				line,
				overUuid: over.outcome_uuid,
				underUuid: under.outcome_uuid,
				overPrice: over.price,
				underPrice: under.price,
			})
		}
	}
	return pairs
}

/**
 * Pair Over and Under sides at the same line by player. A side with no player
 * name pairs with the one remaining opposite side at that line, matching the
 * server's `over.description ?? under.description` fallback.
 */
function pairSides(
	outcomes: PropOutcomeDetailDto[],
): [PropOutcomeDetailDto, PropOutcomeDetailDto][] {
	const lines = new Map<string, PropOutcomeDetailDto[]>()
	for (const outcome of outcomes) {
		const key = String(outcome.point ?? '')
		lines.set(key, [...(lines.get(key) ?? []), outcome])
	}
	const pairs: [PropOutcomeDetailDto, PropOutcomeDetailDto][] = []
	for (const atLine of lines.values()) {
		const overs = atLine.filter((outcome) => sideName(outcome) === 'over')
		const unders = atLine.filter((outcome) => sideName(outcome) === 'under')
		const leftoverOvers: PropOutcomeDetailDto[] = []
		for (const over of overs) {
			const under = unders.find(
				(candidate) =>
					!!over.description &&
					candidate.description === over.description,
			)
			if (!under) {
				leftoverOvers.push(over)
				continue
			}
			pairs.push([over, under])
			unders.splice(unders.indexOf(under), 1)
		}
		const [over] = leftoverOvers
		const [under] = unders
		if (
			over &&
			under &&
			leftoverOvers.length === 1 &&
			unders.length === 1 &&
			(!over.description || !under.description)
		) {
			pairs.push([over, under])
		}
	}
	return pairs
}

export function filterPropPickerPairs(
	pairs: PropPickerPair[],
	filters: PropPickerFilters,
): PropPickerPair[] {
	const game = filters.game.trim().toLowerCase()
	const category = filters.category.trim().toLowerCase()
	const player = filters.player.trim().toLowerCase()
	return pairs.filter(
		(pair) =>
			(game === '' || pair.game.toLowerCase().includes(game)) &&
			(category === '' ||
				pair.marketKey.toLowerCase().includes(category)) &&
			(player === '' ||
				(pair.player ?? '').toLowerCase().includes(player)),
	)
}

export function paginatePropPickerPairs(
	pairs: PropPickerPair[],
	page: number,
	perPage = PROP_PICKER_PAGE_SIZE,
): PropPickerPage {
	const size = Math.max(1, Math.floor(perPage))
	const pages = Math.max(1, Math.ceil(pairs.length / size))
	const current = Math.min(Math.max(0, Math.floor(page) || 0), pages - 1)
	return {
		items: pairs.slice(current * size, (current + 1) * size),
		page: current,
		pages,
		total: pairs.length,
	}
}

export function togglePropPickerSelection(
	selected: readonly string[],
	pairKey: string,
): string[] {
	return selected.includes(pairKey)
		? selected.filter((key) => key !== pairKey)
		: [...selected, pairKey]
}

export function selectedPropPickerPairs(
	pairs: PropPickerPair[],
	selected: readonly string[],
): PropPickerPair[] {
	const wanted = new Set(selected)
	return pairs.filter((pair) => wanted.has(pair.key))
}

export function initialPropPickerPrices(
	pairs: PropPickerPair[],
): Record<string, PropPickerPrice> {
	return Object.fromEntries(
		pairs.map((pair) => [
			pair.key,
			{ over: pair.overPrice, under: pair.underPrice },
		]),
	)
}

/** Compares fresh quotes with what the picker showed the admin last. */
export function diffPropPickerPrices(
	pairs: PropPickerPair[],
	current: ReadonlyMap<string, PropPickerPrice>,
	baseline: Readonly<Record<string, PropPickerPrice>>,
): PropPickerPriceChange[] {
	const changes: PropPickerPriceChange[] = []
	for (const pair of pairs) {
		const before = baseline[pair.key] ?? {
			over: pair.overPrice,
			under: pair.underPrice,
		}
		const after = current.get(pair.key)
		if (
			!after ||
			after.over !== before.over ||
			after.under !== before.under
		) {
			changes.push({
				key: pair.key,
				label: [pair.player, pair.marketKey, pair.line]
					.filter((part) => part !== null && part !== '')
					.join(' · '),
				before,
				after: after ?? before,
			})
		}
	}
	return changes
}
