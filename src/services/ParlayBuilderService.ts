import { randomBytes, randomUUID } from 'node:crypto'
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
	type ParlayResponse,
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
	sessionId: string
	revision: number
	legs: ParlayBuilderLeg[]
	stake: number | null
	placementId: string
	placementPhase: ParlayPlacementPhase
	lastPlacementResponse: ParlayResponse | null
}

export type ParlayPlacementPhase = 'editing' | 'placing' | 'placed' | 'unknown'

export type ParlayBuilderIdentity = Pick<
	ParlayBuilderSession,
	'sessionId' | 'revision'
>

export type ParlayButtonAction =
	| 'add'
	| 'stake'
	| 'confirm'
	| 'cancel'
	| 'remove'

export type ParlayModalKind = 'add-leg' | 'stake'

export const STALE_PARLAY_BUILDER_MESSAGE =
	'This parlay builder is no longer current. Use the latest builder or run `/parlay` again.'

const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{12}$/
const PLACEMENT_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const BUTTON_ID_PATTERN =
	/^parlay\.btn\.([A-Za-z0-9_-]{12})\.(0|[1-9]\d*)\.(add|stake|confirm|cancel|remove)(?:\.(0|[1-9]\d*))?$/
const MODAL_ID_PATTERN =
	/^parlay\.modal\.([A-Za-z0-9_-]{12})\.(0|[1-9]\d*)\.(add-leg|stake)$/

function isPlacementPhase(value: unknown): value is ParlayPlacementPhase {
	return (
		value === 'editing' ||
		value === 'placing' ||
		value === 'placed' ||
		value === 'unknown'
	)
}

export function parlayIdentity(
	session: ParlayBuilderSession,
): ParlayBuilderIdentity {
	return { sessionId: session.sessionId, revision: session.revision }
}

export function buildParlayButtonId(
	identity: ParlayBuilderIdentity,
	action: ParlayButtonAction,
	index?: number,
): string {
	if (action === 'remove') {
		if (!Number.isSafeInteger(index) || Number(index) < 0) {
			throw new Error('Remove controls require a nonnegative leg index.')
		}
		return `parlay.btn.${identity.sessionId}.${identity.revision}.${action}.${index}`
	}
	return `parlay.btn.${identity.sessionId}.${identity.revision}.${action}`
}

export function parseParlayButtonId(customId: string):
	| (ParlayBuilderIdentity & {
			action: ParlayButtonAction
			index?: number
	  })
	| null {
	const match = BUTTON_ID_PATTERN.exec(customId)
	if (!match) return null
	const action = match[3] as ParlayButtonAction
	const index = match[4] === undefined ? undefined : Number(match[4])
	if ((action === 'remove') !== (index !== undefined)) return null
	return {
		sessionId: match[1],
		revision: Number(match[2]),
		action,
		...(index === undefined ? {} : { index }),
	}
}

export function buildParlayModalId(
	identity: ParlayBuilderIdentity,
	kind: ParlayModalKind,
): string {
	return `parlay.modal.${identity.sessionId}.${identity.revision}.${kind}`
}

export function parseParlayModalId(
	customId: string,
): (ParlayBuilderIdentity & { kind: ParlayModalKind }) | null {
	const match = MODAL_ID_PATTERN.exec(customId)
	if (!match) return null
	return {
		sessionId: match[1],
		revision: Number(match[2]),
		kind: match[3] as ParlayModalKind,
	}
}

export type ParlaySide = 'home' | 'away' | 'over' | 'under'

export interface AddParlayLegSelection {
	matchId: string
	marketKey: ParlayMarketKey
	side: ParlaySide
}

export const parlayBuilderKey = (userId: string, guildId: string): string =>
	`parlay-builder:${guildId}:${userId}`

const parlayBuilderLockKey = (userId: string, guildId: string): string =>
	`${parlayBuilderKey(userId, guildId)}:lock`

const parlayBuilderPlacementKey = (userId: string, guildId: string): string =>
	`${parlayBuilderKey(userId, guildId)}:placement`

type BuilderCache = Pick<CacheManager, 'get' | 'set' | 'remove'> & {
	setIfAbsent?: CacheManager['setIfAbsent']
	compareAndRemove?: CacheManager['compareAndRemove']
	refreshIfOwned?: CacheManager['refreshIfOwned']
}

const mutationQueues = new Map<string, Promise<unknown>>()
const localPlacementReservations = new Map<string, string>()

export class ParlayBuilderService {
	constructor(
		private readonly cache: BuilderCache = new CacheManager(),
		private readonly matchCache = new MatchCacheService(new CacheManager()),
		private readonly parlayApi = new ParlayApiWrapper(),
	) {}

	async get(
		userId: string,
		guildId: string,
	): Promise<ParlayBuilderSession | null> {
		const value = await this.cache.get(parlayBuilderKey(userId, guildId))
		if (!value || typeof value !== 'object') return null
		const session = value as Partial<ParlayBuilderSession>
		if (
			!SESSION_ID_PATTERN.test(session.sessionId ?? '') ||
			!Number.isSafeInteger(session.revision) ||
			Number(session.revision) < 0 ||
			!Array.isArray(session.legs) ||
			!PLACEMENT_ID_PATTERN.test(session.placementId ?? '') ||
			!isPlacementPhase(session.placementPhase) ||
			(session.lastPlacementResponse !== null &&
				typeof session.lastPlacementResponse !== 'object')
		) {
			return null
		}
		return {
			sessionId: session.sessionId!,
			revision: session.revision!,
			legs: session.legs as ParlayBuilderLeg[],
			stake: typeof session.stake === 'number' ? session.stake : null,
			placementId: session.placementId!,
			placementPhase: session.placementPhase!,
			lastPlacementResponse:
				session.lastPlacementResponse as ParlayResponse | null,
		}
	}

	async start(
		userId: string,
		guildId: string,
	): Promise<ParlayBuilderSession> {
		return this.withSessionLock(userId, guildId, async () => {
			await this.ensureNotReserved(userId, guildId)
			const session: ParlayBuilderSession = {
				sessionId: randomBytes(9).toString('base64url'),
				revision: 0,
				legs: [],
				stake: null,
				placementId: randomUUID(),
				placementPhase: 'editing',
				lastPlacementResponse: null,
			}
			await this.saveUnlocked(userId, guildId, session)
			return session
		})
	}

	private async saveUnlocked(
		userId: string,
		guildId: string,
		session: ParlayBuilderSession,
	): Promise<void> {
		await this.cache.set(
			parlayBuilderKey(userId, guildId),
			session,
			PARLAY_BUILDER_TTL_SECONDS,
		)
	}

	async clear(
		userId: string,
		guildId: string,
		expected: ParlayBuilderIdentity,
	): Promise<void> {
		await this.withSessionLock(userId, guildId, async () => {
			await this.ensureNotReserved(userId, guildId)
			const session = await this.requireSession(userId, guildId)
			this.assertIdentity(session, expected)
			await this.cache.remove(parlayBuilderKey(userId, guildId))
		})
	}

	async clearWithPlacementToken(
		userId: string,
		guildId: string,
		placementToken?: string,
	): Promise<void> {
		await this.withSessionLock(userId, guildId, async () => {
			const reservationKey = parlayBuilderPlacementKey(userId, guildId)
			const localOwner = localPlacementReservations.get(reservationKey)
			if (localOwner && localOwner !== placementToken) {
				throw new Error(
					'Your parlay is already being placed. Please wait for the result.',
				)
			}
			if (this.cache.setIfAbsent) {
				const active = await this.cache.get(reservationKey)
				if (
					placementToken ? active !== placementToken : Boolean(active)
				) {
					throw new Error(
						'Your parlay is already being placed. Please wait for the result.',
					)
				}
			}
			await this.cache.remove(parlayBuilderKey(userId, guildId))
		})
	}

	async setStake(
		userId: string,
		guildId: string,
		expected: ParlayBuilderIdentity,
		stake: number,
	): Promise<ParlayBuilderSession> {
		if (!Number.isSafeInteger(stake) || stake <= 0) {
			throw new Error('Stake must be a whole number greater than $0.')
		}
		return this.mutateSession(userId, guildId, expected, (session) => ({
			...session,
			stake,
		}))
	}

	async removeLeg(
		userId: string,
		guildId: string,
		expected: ParlayBuilderIdentity,
		index: number,
	): Promise<ParlayBuilderSession> {
		return this.mutateSession(userId, guildId, expected, (session) => {
			if (index < 0 || index >= session.legs.length) {
				throw new Error('That parlay leg is no longer available.')
			}
			return {
				...session,
				legs: session.legs.filter((_, i) => i !== index),
			}
		})
	}

	async addLeg(
		userId: string,
		guildId: string,
		expected: ParlayBuilderIdentity,
		selection: AddParlayLegSelection,
	): Promise<ParlayBuilderSession> {
		return this.mutateSession(
			userId,
			guildId,
			expected,
			async (session) => {
				if (session.legs.length >= PARLAY_BUILDER_MAX_LEGS) {
					throw new Error('A parlay can contain at most 6 legs.')
				}
				if (
					session.legs.some(
						(item) => item.event_id === selection.matchId,
					)
				) {
					throw new Error(
						'Each parlay leg must use a different game.',
					)
				}
				const leg = await this.resolveLeg(selection)
				return { ...session, legs: [...session.legs, leg] }
			},
		)
	}

	/**
	 * Reserve a builder before calling Khronos. The Redis NX boundary keeps
	 * duplicate confirm interactions from placing the same wager twice.
	 */
	async reserveForPlacement(
		userId: string,
		guildId: string,
		expected: ParlayBuilderIdentity,
	): Promise<{ session: ParlayBuilderSession; token: string } | null> {
		return this.withSessionLock(userId, guildId, async () => {
			const reservationKey = parlayBuilderPlacementKey(userId, guildId)
			if (localPlacementReservations.has(reservationKey)) return null
			const session = await this.requireSession(userId, guildId)
			this.assertIdentity(session, expected)
			if (session.placementPhase !== 'editing') return null
			const token = randomUUID()
			localPlacementReservations.set(reservationKey, token)
			let acquired = !this.cache.setIfAbsent
			let reserved = false
			try {
				if (this.cache.setIfAbsent) {
					acquired = await this.cache.setIfAbsent(
						reservationKey,
						token,
						120,
					)
					if (!acquired) return null
				}
				const placingSession: ParlayBuilderSession = {
					...session,
					placementPhase: 'placing',
				}
				await this.saveUnlocked(userId, guildId, placingSession)
				reserved = true
				return { session: placingSession, token }
			} finally {
				if (!reserved) {
					await this.releasePlacement(userId, guildId, token)
				}
			}
		})
	}

	async setPlacementState(
		userId: string,
		guildId: string,
		expected: ParlayBuilderIdentity,
		placementPhase: ParlayPlacementPhase,
		lastPlacementResponse: ParlayResponse | null = null,
	): Promise<ParlayBuilderSession> {
		return this.withSessionLock(userId, guildId, async () => {
			const session = await this.requireSession(userId, guildId)
			this.assertIdentity(session, expected)
			const updated: ParlayBuilderSession = {
				...session,
				placementPhase,
				lastPlacementResponse,
			}
			await this.saveUnlocked(userId, guildId, updated)
			return updated
		})
	}

	async assertCurrent(
		userId: string,
		guildId: string,
		expected: ParlayBuilderIdentity,
	): Promise<ParlayBuilderSession> {
		const session = await this.requireSession(userId, guildId)
		this.assertIdentity(session, expected)
		return session
	}

	async releasePlacement(
		userId: string,
		guildId: string,
		token?: string,
	): Promise<void> {
		const reservationKey = parlayBuilderPlacementKey(userId, guildId)
		if (token && this.cache.compareAndRemove) {
			await this.cache.compareAndRemove(reservationKey, token)
		} else {
			await this.cache.remove(reservationKey)
		}
		if (
			!token ||
			localPlacementReservations.get(reservationKey) === token
		) {
			localPlacementReservations.delete(reservationKey)
		}
	}

	async refreshPlacement(
		userId: string,
		guildId: string,
		token: string,
	): Promise<boolean> {
		if (!this.cache.refreshIfOwned) return true
		return this.cache.refreshIfOwned(
			parlayBuilderPlacementKey(userId, guildId),
			token,
			120,
		)
	}

	private async mutateSession(
		userId: string,
		guildId: string,
		expected: ParlayBuilderIdentity,
		mutator: (
			session: ParlayBuilderSession,
		) => ParlayBuilderSession | Promise<ParlayBuilderSession>,
	): Promise<ParlayBuilderSession> {
		return this.withSessionLock(userId, guildId, async () => {
			await this.ensureNotReserved(userId, guildId)
			const session = await this.requireSession(userId, guildId)
			this.assertIdentity(session, expected)
			const updated = await mutator(session)
			const versioned: ParlayBuilderSession = {
				...updated,
				sessionId: session.sessionId,
				revision: session.revision + 1,
			}
			await this.saveUnlocked(userId, guildId, versioned)
			return versioned
		})
	}

	private async requireSession(
		userId: string,
		guildId: string,
	): Promise<ParlayBuilderSession> {
		const session = await this.get(userId, guildId)
		if (!session) {
			throw new Error(
				'Your parlay builder expired. Run `/parlay` to start again.',
			)
		}
		return session
	}

	private assertIdentity(
		session: ParlayBuilderSession,
		expected: ParlayBuilderIdentity,
	): void {
		if (
			session.sessionId !== expected.sessionId ||
			session.revision !== expected.revision
		) {
			throw new Error(STALE_PARLAY_BUILDER_MESSAGE)
		}
	}

	private async ensureNotReserved(
		userId: string,
		guildId: string,
	): Promise<void> {
		const reservationKey = parlayBuilderPlacementKey(userId, guildId)
		if (localPlacementReservations.has(reservationKey)) {
			throw new Error(
				'Your parlay is already being placed. Please wait for the result.',
			)
		}
		if (this.cache.setIfAbsent && (await this.cache.get(reservationKey))) {
			throw new Error(
				'Your parlay is already being placed. Please wait for the result.',
			)
		}
	}

	private async withSessionLock<T>(
		userId: string,
		guildId: string,
		operation: () => Promise<T>,
	): Promise<T> {
		const scope = parlayBuilderKey(userId, guildId)
		const previous = mutationQueues.get(scope) ?? Promise.resolve()
		const current = previous
			.catch(() => undefined)
			.then(async () => {
				const token = randomUUID()
				const lockKey = parlayBuilderLockKey(userId, guildId)
				let locked = false
				if (this.cache.setIfAbsent) {
					for (let attempt = 0; attempt < 40; attempt += 1) {
						if (await this.cache.setIfAbsent(lockKey, token, 120)) {
							locked = true
							break
						}
						await new Promise((resolve) => setTimeout(resolve, 25))
					}
					if (!locked)
						throw new Error(
							'Your parlay builder is busy. Please try again in a moment.',
						)
				}
				try {
					return await operation()
				} finally {
					if (locked) {
						if (this.cache.compareAndRemove) {
							await this.cache.compareAndRemove(lockKey, token)
						} else {
							await this.cache.remove(lockKey)
						}
					}
				}
			})
		mutationQueues.set(scope, current)
		try {
			return await current
		} finally {
			if (mutationQueues.get(scope) === current)
				mutationQueues.delete(scope)
		}
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
		if (!match.sport) {
			throw new Error(
				'That game is missing sport information. Please try again.',
			)
		}

		const outcomes = await this.parlayApi.getEventOutcomes(
			match.sport,
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
						.setCustomId(
							buildParlayButtonId(session, 'remove', index),
						)
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
					.setCustomId(buildParlayButtonId(session, 'add'))
					.setLabel('Add Leg')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId(buildParlayButtonId(session, 'stake'))
					.setLabel('Set Stake')
					.setStyle(ButtonStyle.Secondary),
				new ButtonBuilder()
					.setCustomId(buildParlayButtonId(session, 'confirm'))
					.setLabel('Confirm')
					.setStyle(ButtonStyle.Success)
					.setDisabled(
						session.legs.length < 2 || session.stake === null,
					),
				new ButtonBuilder()
					.setCustomId(buildParlayButtonId(session, 'cancel'))
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
