import type { PostPropsResponseDto, PropDto } from '@pluto-khronos/api-client'
import type PropsApiWrapper from '../api/Khronos/props/props-api-wrapper.js'
import {
	buildPropPickerPairs,
	diffPropPickerPrices,
	EMPTY_PROP_PICKER_FILTERS,
	filterPropPickerPairs,
	initialPropPickerPrices,
	type PropPickerFilters,
	type PropPickerPair,
	type PropPickerPrice,
	type PropPickerPriceChange,
	selectedPropPickerPairs,
} from './PropPicker.js'
import type { PropPickerSession } from './PropPickerStore.js'

export type PropPickerApi = Pick<
	PropsApiWrapper,
	'getAvailableProps' | 'getPropByUuid' | 'postSelectedProps'
>

export type PropPickerStartInput = {
	token: string
	userId: string
	guildId: string
	sport: 'nba' | 'nfl'
	filters?: Partial<PropPickerFilters>
}

export type PropPickerRecheck = {
	changes: PropPickerPriceChange[]
	missing: PropPickerPair[]
	prices: Record<string, PropPickerPrice>
}

/** Pairing, filtering, price checks and posting for the admin picker. */
export class PropPickerService {
	constructor(private readonly api: PropPickerApi) {}

	async start(input: PropPickerStartInput): Promise<PropPickerSession> {
		const props = await this.api.getAvailableProps(input.sport)
		const filters = {
			...EMPTY_PROP_PICKER_FILTERS,
			...input.filters,
		}
		const pairs = filterPropPickerPairs(
			buildPropPickerPairs(props),
			filters,
		).sort(comparePairs)
		return {
			token: input.token,
			userId: input.userId,
			guildId: input.guildId,
			sport: input.sport,
			filters,
			page: 0,
			selected: [],
			pairs,
			prices: initialPropPickerPrices(pairs),
		}
	}

	/**
	 * Re-reads every selected pair's market before posting. A moved or missing
	 * quote updates the session so the next Post click publishes what the admin
	 * was shown, never the stale quote.
	 */
	async recheck(session: PropPickerSession): Promise<PropPickerRecheck> {
		const selected = selectedPropPickerPairs(
			session.pairs,
			session.selected,
		)
		const current = new Map<string, PropPickerPrice>()
		const missing: PropPickerPair[] = []
		await Promise.all(
			selected.map(async (pair) => {
				try {
					const prop = await this.api.getPropByUuid(pair.overUuid)
					const over = prop.outcomes.find(
						(outcome) => outcome.outcome_uuid === pair.overUuid,
					)
					const under = prop.outcomes.find(
						(outcome) => outcome.outcome_uuid === pair.underUuid,
					)
					if (!over || !under) {
						missing.push(pair)
						return
					}
					current.set(pair.key, {
						over: over.price,
						under: under.price,
					})
				} catch {
					missing.push(pair)
				}
			}),
		)
		const changes = diffPropPickerPrices(selected, current, session.prices)
		return {
			changes,
			missing: missing.sort((left, right) =>
				left.key.localeCompare(right.key),
			),
			prices: {
				...session.prices,
				...Object.fromEntries(current),
			},
		}
	}

	async post(session: PropPickerSession): Promise<PostPropsResponseDto> {
		const selected = selectedPropPickerPairs(
			session.pairs,
			session.selected,
		)
		if (selected.length === 0) {
			throw new Error('Select at least one prop to post')
		}
		return this.api.postSelectedProps({
			sport: session.sport,
			outcomeUuids: selected.map((pair) => pair.overUuid),
			guildIds: [session.guildId],
		})
	}
}

function comparePairs(left: PropPickerPair, right: PropPickerPair): number {
	return (
		(Date.parse(left.commenceTime) || 0) -
			(Date.parse(right.commenceTime) || 0) ||
		left.game.localeCompare(right.game) ||
		(left.player ?? '').localeCompare(right.player ?? '') ||
		left.marketKey.localeCompare(right.marketKey) ||
		(left.line ?? 0) - (right.line ?? 0)
	)
}

export type { PropPickerSession }
