import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ContainerBuilder,
	type InteractionEditReplyOptions,
	MessageFlags,
	SectionBuilder,
	SeparatorSpacingSize,
} from 'discord.js'
import ParlayApiWrapper, {
	type EventOutcome,
	type ParlayLegInput,
	type ParlayMarketKey,
} from '../utils/api/Khronos/parlays/ParlayApiWrapper.js'
import MatchCacheService from '../utils/api/routes/cache/match-cache-service.js'
import { combineAmericanOdds } from '../utils/betting/american-odds.js'
import { CacheManager } from '../utils/cache/cache-manager.js'
import { logger } from '../utils/logging/WinstonLogger.js'

export const PARLAY_BUILDER_TTL_SECONDS = 15 * 60
export const PARLAY_BUILDER_MAX_LEGS = 6

export interface ParlayBuilderLeg extends ParlayLegInput {
	market_key: ParlayMarketKey
	selection_display: string
	odds_american: number
	point: number | null
	commence_time: string
}

export interface ParlayBuilderSession {
	legs: ParlayBuilderLeg[]
	stake: number | null
}

export type ParlaySide = 'home' | 'away' | 'over' | 'under'

export interface AddParlayLegSelection {
	matchId: string
	marketKey: ParlayMarketKey
	side: ParlaySide
}

export const parlayBuilderKey = (userId: string): string =>
	`parlay-builder:${userId}`

export class ParlayBuilderService {
	constructor(
		private readonly cache: CacheManager = new CacheManager(),
		private readonly matchCache = new MatchCacheService(new CacheManager()),
		private readonly parlayApi = new ParlayApiWrapper(),
	) {}

	async get(userId: string): Promise<ParlayBuilderSession | null> {
		const value = await this.cache.get(parlayBuilderKey(userId))
		if (!value || typeof value !== 'object') return null
		const session = value as Partial<ParlayBuilderSession>
		if (!Array.isArray(session.legs)) return null
		return {
			legs: session.legs as ParlayBuilderLeg[],
			stake: typeof session.stake === 'number' ? session.stake : null,
		}
	}

	async start(userId: string): Promise<ParlayBuilderSession> {
		const session: ParlayBuilderSession = { legs: [], stake: null }
		await this.save(userId, session)
		return session
	}

	async save(userId: string, session: ParlayBuilderSession): Promise<void> {
		await this.cache.set(
			parlayBuilderKey(userId),
			session,
			PARLAY_BUILDER_TTL_SECONDS,
		)
	}

	async clear(userId: string): Promise<void> {
		await this.cache.remove(parlayBuilderKey(userId))
	}

	async setStake(
		userId: string,
		stake: number,
	): Promise<ParlayBuilderSession> {
		if (!Number.isSafeInteger(stake) || stake <= 0) {
			throw new Error('Stake must be a whole number greater than $0.')
		}
		const session = await this.get(userId)
		if (!session)
			throw new Error(
				'Your parlay builder expired. Run `/parlay` to start again.',
			)
		const updated = { ...session, stake }
		await this.save(userId, updated)
		return updated
	}

	async removeLeg(
		userId: string,
		index: number,
	): Promise<ParlayBuilderSession> {
		const session = await this.get(userId)
		if (!session)
			throw new Error(
				'Your parlay builder expired. Run `/parlay` to start again.',
			)
		if (index < 0 || index >= session.legs.length) {
			throw new Error('That parlay leg is no longer available.')
		}
		const updated = {
			...session,
			legs: session.legs.filter((_, i) => i !== index),
		}
		await this.save(userId, updated)
		return updated
	}

	async addLeg(
		userId: string,
		selection: AddParlayLegSelection,
	): Promise<ParlayBuilderSession> {
		const session = await this.get(userId)
		if (!session)
			throw new Error(
				'Your parlay builder expired. Run `/parlay` to start again.',
			)
		if (session.legs.length >= PARLAY_BUILDER_MAX_LEGS) {
			throw new Error('A parlay can contain at most 6 legs.')
		}
		if (session.legs.some((leg) => leg.event_id === selection.matchId)) {
			throw new Error('Each parlay leg must use a different game.')
		}

		const leg = await this.resolveLeg(selection)
		const updated = { ...session, legs: [...session.legs, leg] }
		await this.save(userId, updated)
		return updated
	}

	async resolveLeg(
		selection: AddParlayLegSelection,
	): Promise<ParlayBuilderLeg> {
		const match = await this.matchCache.getMatch(selection.matchId)
		if (!match?.id || !match.home_team || !match.away_team) {
			throw new Error('Choose a valid upcoming game from the list.')
		}
		if (
			match.commence_time &&
			new Date(match.commence_time).getTime() <= Date.now()
		) {
			throw new Error(
				'That game has already started. Choose another game.',
			)
		}

		const outcomes = await this.parlayApi.getEventOutcomes(
			match.sport ?? 'nba',
			match.id,
		)
		const marketOutcomes = outcomes.filter(
			(outcome) => outcome.market_key === selection.marketKey,
		)
		const outcome = this.selectOutcome(
			marketOutcomes,
			selection.side,
			match.home_team,
			match.away_team,
		)
		if (!outcome?.uuid || outcome.price === undefined) {
			throw new Error(
				'That selection is no longer available. Try another leg.',
			)
		}

		const selectionDisplay = this.selectionDisplay(
			selection.marketKey,
			selection.side,
			match.home_team,
			match.away_team,
			outcome.point,
		)
		return {
			event_id: match.id,
			outcome_uuid: outcome.uuid,
			market_key: selection.marketKey,
			selection_display: selectionDisplay,
			odds_american: outcome.price,
			point: outcome.point ?? null,
			commence_time: match.commence_time ?? new Date().toISOString(),
		}
	}

	private selectOutcome(
		outcomes: EventOutcome[],
		side: ParlaySide,
		homeTeam: string,
		awayTeam: string,
	): EventOutcome | undefined {
		return outcomes.find((outcome) => {
			const name = outcome.name?.trim().toLowerCase()
			const position = outcome.position?.toLowerCase()
			const outcomeType = outcome.outcome_type?.toLowerCase()
			if (side === 'over' || side === 'under') {
				return name === side || outcomeType === side
			}
			const team = side === 'home' ? homeTeam : awayTeam
			return (
				name === team.toLowerCase() ||
				position === side ||
				outcomeType === `team_${side}`
			)
		})
	}

	private selectionDisplay(
		market: ParlayMarketKey,
		side: ParlaySide,
		homeTeam: string,
		awayTeam: string,
		point?: number | null,
	): string {
		if (market === 'totals')
			return `${side === 'over' ? 'Over' : 'Under'}${point === undefined || point === null ? '' : ` ${point}`}`
		const team = side === 'home' ? homeTeam : awayTeam
		return market === 'spreads' && point !== undefined && point !== null
			? `${team} ${point > 0 ? '+' : ''}${point}`
			: team
	}

	validateForPlacement(session: ParlayBuilderSession): void {
		if (session.legs.length < 2) {
			throw new Error('Add at least 2 different games before confirming.')
		}
		if (session.legs.length > PARLAY_BUILDER_MAX_LEGS) {
			throw new Error('A parlay can contain at most 6 legs.')
		}
		if (!session.stake)
			throw new Error('Set a stake before confirming your parlay.')
	}

	getOddsSummary(session: ParlayBuilderSession): {
		american: number
		decimal: number
		potentialPayout: number | null
	} {
		if (session.legs.length === 0) {
			return { american: 0, decimal: 1, potentialPayout: null }
		}
		const combined = combineAmericanOdds(
			session.legs.map((leg) => leg.odds_american),
		)
		return {
			...combined,
			potentialPayout:
				session.stake === null
					? null
					: Math.round(session.stake * combined.decimal * 100) / 100,
		}
	}

	render(session: ParlayBuilderSession): InteractionEditReplyOptions {
		const summary = this.getOddsSummary(session)
		const container = new ContainerBuilder().setAccentColor(0x5865f2)
		container.addTextDisplayComponents((text) =>
			text.setContent('## 🎲 Build your parlay'),
		)
		if (session.legs.length === 0) {
			container.addTextDisplayComponents((text) =>
				text.setContent(
					'Add 2–6 legs from different upcoming games to get started.',
				),
			)
		}
		for (const [index, leg] of session.legs.entries()) {
			const section = new SectionBuilder()
				.addTextDisplayComponents((text) =>
					text.setContent(
						`**${index + 1}. ${leg.selection_display}**\n${leg.market_key} • ${leg.odds_american > 0 ? '+' : ''}${leg.odds_american} • <t:${Math.floor(new Date(leg.commence_time).getTime() / 1000)}:f>`,
					),
				)
				.setButtonAccessory(
					new ButtonBuilder()
						.setCustomId(`parlay_btn_remove_${index}`)
						.setLabel('Remove')
						.setStyle(ButtonStyle.Danger),
				)
			container.addSectionComponents(section)
		}
		container.addSeparatorComponents((separator) =>
			separator.setDivider(true).setSpacing(SeparatorSpacingSize.Small),
		)
		const payoutText =
			summary.potentialPayout === null
				? 'Set a stake to calculate potential payout.'
				: `Potential payout: **$${summary.potentialPayout.toFixed(2)}**`
		container.addTextDisplayComponents((text) =>
			text.setContent(
				`Combined odds: **${summary.american > 0 ? '+' : ''}${summary.american || '—'}** (${summary.decimal.toFixed(2)}x)\nStake: **${session.stake === null ? 'Not set' : `$${session.stake.toFixed(2)}`}**\n${payoutText}`,
			),
		)
		container.addActionRowComponents((row) =>
			row.addComponents(
				new ButtonBuilder()
					.setCustomId('parlay_btn_add')
					.setLabel('Add Leg')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId('parlay_btn_stake')
					.setLabel('Set Stake')
					.setStyle(ButtonStyle.Secondary),
				new ButtonBuilder()
					.setCustomId('parlay_btn_confirm')
					.setLabel('Confirm')
					.setStyle(ButtonStyle.Success)
					.setDisabled(
						session.legs.length < 2 || session.stake === null,
					),
				new ButtonBuilder()
					.setCustomId('parlay_btn_cancel')
					.setLabel('Cancel')
					.setStyle(ButtonStyle.Danger),
			),
		)
		return { components: [container], flags: MessageFlags.IsComponentsV2 }
	}

	renderMessage(
		content: string,
		color = 0xed4245,
	): InteractionEditReplyOptions {
		const container = new ContainerBuilder()
			.setAccentColor(color)
			.addTextDisplayComponents((text) => text.setContent(content))
		return { components: [container], flags: MessageFlags.IsComponentsV2 }
	}
}

export function logParlayBuilderError(
	error: unknown,
	metadata: Record<string, unknown>,
): void {
	logger.error('parlay_builder_error', {
		...metadata,
		error: error instanceof Error ? error.message : String(error),
	})
}

export function getParlayErrorMessage(error: unknown): string {
	const responseData = (error as { response?: { data?: unknown } })?.response
		?.data
	if (typeof responseData === 'object' && responseData !== null) {
		const message = (responseData as { message?: unknown }).message
		if (typeof message === 'string') return message
		if (
			Array.isArray(message) &&
			message.every((item) => typeof item === 'string')
		) {
			return message.join(', ')
		}
	}
	return error instanceof Error
		? error.message
		: 'Unable to process your parlay.'
}
