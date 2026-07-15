import { randomUUID } from 'node:crypto'
import type {
	Account,
	CancelBetslipRequest,
	ClearPendingBetsRequest,
	DoubleDownBetRequest,
	DoubleDownDto,
	GetActiveBetslipsRequest,
	GetAllMatchesDto,
	GetBalanceDto,
	GetGuildsBySportAndConfigTypeRequest,
	GetLeaderboardDto,
	GetProfileDto,
	GetUserBetslipsRequest,
	Guild,
	InitBetslipRequest,
	InitBetslipRespDTO,
	MatchesForSportRequest,
	PlaceBetslipRequest,
	PlacedBetslip,
	PlacedBetslipDto,
} from '@pluto-khronos/api-client'
import {
	DiscordConfigSettingTypeEnum,
	PlacedBetslipBetresultEnum,
} from '@pluto-khronos/api-client'
import { DEV_IDS } from '../../lib/configs/constants.js'
import env from '../../lib/startup/env.js'
import { DiscordConfigEnums } from '../api/common/interfaces/kh-pluto/kh-pluto.interface.js'
import type {
	EventOutcome,
	InitParlayRequest,
	InitParlayResponse,
	ParlayResponse,
	PlacedParlayLeg,
	UserParlaysResponse,
} from '../api/Khronos/parlays/ParlayApiWrapper.js'
import {
	makeBetslipWithAggregation,
	makePlacedBetslip,
} from './factories/betslips.js'
import { makeMatchesForSport, makeUpcomingGame } from './factories/games.js'
import { asMockSport, MOCK_SPORTS, type MockSport } from './factories/teams.js'
import { MockStore } from './mock-store.js'

const PARLAY_INIT_TTL_MS = 15 * 60 * 1000
const PARLAY_MIN_LEGS = 2
const PARLAY_MAX_LEGS = 6
const PARLAY_MIN_STAKE = 1
const PARLAY_MAX_STAKE = 10_000
const PARLAY_MAX_PAYOUT = 1_000_000

type PendingParlay = {
	request: InitParlayRequest
	preview: InitParlayResponse
	expiresAt: number
}

type TerminalParlayResult = Exclude<PlacedParlayLeg['result'], 'pending'>
const TERMINAL_RESULTS = new Set<TerminalParlayResult>([
	'won',
	'lost',
	'push',
	'void',
])
export type MockParlayTerminalListener = (parlay: ParlayResponse) => void

export class MockBackend {
	private static backend: MockBackend | undefined
	private readonly store = new MockStore()
	private readonly matchesBySport = new Map<
		MockSport,
		GetAllMatchesDto['matches']
	>()
	private nextBetId = 10_000
	private nextParlayId = 20_000
	private readonly pendingParlays = new Map<string, PendingParlay>()
	private readonly parlays = new Map<string, ParlayResponse>()
	private readonly terminalListeners = new Set<MockParlayTerminalListener>()

	private constructor() {
		if (env.NODE_ENV === 'production') {
			throw new Error('USE_MOCK_DATA cannot be enabled in production')
		}
	}

	static instance(): MockBackend {
		this.backend ??= new MockBackend()
		return this.backend
	}

	seedGames(sport: MockSport, count = 5): GetAllMatchesDto {
		const response = makeMatchesForSport(sport, count)
		this.matchesBySport.set(sport, response.matches)
		return response
	}

	getMatchesForSport(request: MatchesForSportRequest): GetAllMatchesDto {
		const sport = asMockSport(request.sport)
		const matches = this.matchesBySport.get(sport)
		if (matches) {
			return { statusCode: 200, matches }
		}
		return this.seedGames(sport, 5)
	}

	getAllMatches(): GetAllMatchesDto {
		const matches = MOCK_SPORTS.flatMap(
			(sport) => this.getMatchesForSport({ sport }).matches,
		)
		return { statusCode: 200, matches }
	}

	getGuild(guildId: string): Guild {
		if (!env.MOCK_GUILD_BETTING_CHAN_ID) {
			throw new Error(
				'MOCK_GUILD_BETTING_CHAN_ID is required when USE_MOCK_DATA is enabled',
			)
		}
		if (!env.DEV_GUILD_GAMES_CATEGORY_ID) {
			throw new Error(
				'DEV_GUILD_GAMES_CATEGORY_ID is required when USE_MOCK_DATA is enabled',
			)
		}

		const config = []
		// Both IDs are startup-required when USE_MOCK_DATA is enabled
		config.push({
			id: `mock-${DiscordConfigEnums.BETTING_CHANNEL}`,
			guild_id: guildId,
			setting_type: DiscordConfigSettingTypeEnum.BettingChan,
			setting_value: env.MOCK_GUILD_BETTING_CHAN_ID,
		})
		config.push({
			id: `mock-${DiscordConfigEnums.GAMES_CATEGORY}`,
			guild_id: guildId,
			setting_type: DiscordConfigSettingTypeEnum.GamesCategory,
			setting_value: env.DEV_GUILD_GAMES_CATEGORY_ID,
		})

		return {
			guild_id: guildId,
			guild_name: 'Mock Guild',
			date_joined: new Date().toISOString(),
			sport: env.MOCK_GUILD_SPORT,
			config,
		}
	}

	getGuildsForSportWithConfig(
		params: GetGuildsBySportAndConfigTypeRequest,
	): Guild[] {
		const guildId = DEV_IDS.guild
		const guild = this.getGuild(guildId)
		return guild.sport === params.sport ? [guild] : []
	}

	initBetslip(request: InitBetslipRequest): InitBetslipRespDTO {
		const dto = request.initBetslipDTO
		const game = this.findGameForBet(
			asMockSport(request.sport),
			dto.event_id ?? dto.matchup_id,
			dto.team,
		)
		return {
			statusCode: 201,
			betslip: makeBetslipWithAggregation({
				userId: dto.userid,
				team: dto.team,
				amount: dto.amount,
				sport: request.sport,
				game,
			}),
		}
	}

	placeBetslip(request: PlaceBetslipRequest): PlacedBetslipDto {
		const dto = request.placeBetDto
		const game =
			this.findGameById(dto.matchup_id) ??
			makeUpcomingGame({
				sport: asMockSport(env.MOCK_GUILD_SPORT),
				id: dto.matchup_id,
			})
		const newBalance = this.store.debit(dto.userid, dto.amount)
		const bet = makePlacedBetslip({
			placeBetDto: dto,
			game,
			newBalance,
			betId: this.nextBetId++,
		})
		this.store.placeBet(bet)
		return { statusCode: 201, betslip: bet }
	}

	cancelBetslip(request: CancelBetslipRequest) {
		this.store.cancelBet(request.userId, request.betId)
		return {
			statusCode: 200,
			message: `Mock bet ${request.betId} cancelled`,
		}
	}

	getActiveBetslips(request: GetActiveBetslipsRequest): PlacedBetslip[] {
		return this.store
			.getBets(request.userid)
			.filter(
				(bet) => bet.betresult === PlacedBetslipBetresultEnum.Pending,
			)
	}

	getUserBetslips(request: GetUserBetslipsRequest): PlacedBetslip[] {
		return this.store.getBets(request.userid)
	}

	initParlay(request: InitParlayRequest): InitParlayResponse {
		this.validateParlayRequest(request)
		const legs = request.legs.map((leg) => {
			const market_key = this.marketKeyForOutcome(leg.outcome_uuid)
			const isHome = leg.outcome_uuid.endsWith('-home')
			const isOver = leg.outcome_uuid.endsWith('-over')
			return {
				event_id: leg.event_id,
				outcome_uuid: leg.outcome_uuid,
				market_key,
				selection_display:
					market_key === 'totals'
						? isOver
							? 'Over 220.5'
							: 'Under 220.5'
						: `Mock ${isHome ? 'home' : 'away'} selection`,
				odds_american: -110,
				point:
					market_key === 'spreads'
						? isHome
							? -1.5
							: 1.5
						: market_key === 'totals'
							? 220.5
							: null,
				commence_time: new Date(
					Date.now() + 6 * 3_600_000,
				).toISOString(),
			}
		})
		const decimal = legs.reduce(
			(product, leg) => product * this.decimalOdds(leg.odds_american),
			1,
		)
		const expiresAt = Date.now() + PARLAY_INIT_TTL_MS
		const preview: InitParlayResponse = {
			init_token: randomUUID(),
			combined_odds_american: Math.round((decimal - 1) * 100),
			potential_payout: Math.round(request.stake * decimal * 100) / 100,
			legs,
			expires_at: new Date(expiresAt).toISOString(),
		}
		if (preview.potential_payout > PARLAY_MAX_PAYOUT) {
			throw new Error(
				`Parlay potential payout cannot exceed ${PARLAY_MAX_PAYOUT}.`,
			)
		}
		this.pendingParlays.set(preview.init_token, {
			request,
			preview,
			expiresAt,
		})
		return preview
	}

	placeParlay(initToken: string): ParlayResponse {
		const pending = this.pendingParlays.get(initToken)
		if (!pending || pending.expiresAt <= Date.now()) {
			this.pendingParlays.delete(initToken)
			throw new Error('Mock parlay initialization expired.')
		}
		this.pendingParlays.delete(initToken)
		const { request, preview } = pending
		this.store.debit(request.user_id, request.stake)
		const id = `mock-parlay-${this.nextParlayId++}`
		const parlay: ParlayResponse = {
			id,
			user_id: request.user_id,
			guild_id: request.guild_id,
			stake: request.stake,
			combined_odds_american: preview.combined_odds_american,
			potential_payout: preview.potential_payout,
			actual_payout: null,
			status: 'pending',
			leg_count: preview.legs.length,
			created_at: new Date().toISOString(),
			settled_at: null,
			legs: preview.legs.map((leg, index) => ({
				...leg,
				id: `${id}-leg-${index + 1}`,
				result: 'pending',
				settled_at: null,
			})),
		}
		this.parlays.set(id, parlay)
		return parlay
	}

	getUserParlays(
		userId: string,
		options: { page?: number; limit?: number; status?: string } = {},
	): UserParlaysResponse {
		const limit = options.limit ?? 10
		const page = options.page ?? 1
		const all = [...this.parlays.values()].filter(
			(parlay) =>
				parlay.user_id === userId &&
				(!options.status || parlay.status === options.status),
		)
		const start = (page - 1) * limit
		return {
			parlays: all.slice(start, start + limit),
			page,
			limit,
			total: all.length,
			total_pages: Math.max(1, Math.ceil(all.length / limit)),
		}
	}

	cancelParlay(parlayId: string, userId: string): ParlayResponse {
		const parlay = this.parlays.get(parlayId)
		if (!parlay || parlay.user_id !== userId) {
			throw new Error('Mock parlay was not found for this user.')
		}
		if (parlay.status !== 'pending') {
			throw new Error('Mock parlay is no longer cancellable.')
		}
		const earliestCommence = parlay.legs.reduce(
			(earliest, leg) =>
				new Date(leg.commence_time).getTime() < earliest
					? new Date(leg.commence_time).getTime()
					: earliest,
			Number.POSITIVE_INFINITY,
		)
		if (earliestCommence <= Date.now()) {
			throw new Error('Mock parlay cancellation window has closed.')
		}
		const cancelled = {
			...parlay,
			status: 'cancelled' as const,
			actual_payout: parlay.stake,
			settled_at: new Date().toISOString(),
		}
		this.store.credit(userId, parlay.stake)
		this.parlays.set(parlayId, cancelled)
		this.notifyTerminal(cancelled)
		return cancelled
	}

	/** Register the in-process sink used by hermetic notification tests. */
	onParlayTerminal(listener: MockParlayTerminalListener): () => void {
		this.terminalListeners.add(listener)
		return () => this.terminalListeners.delete(listener)
	}

	/** Apply one immutable outcome result and resolve the parlay when terminal. */
	settleParlayLeg(
		parlayId: string,
		outcomeUuid: string,
		result: TerminalParlayResult,
	): ParlayResponse {
		const parlay = this.parlays.get(parlayId)
		if (!parlay) throw new Error('Mock parlay was not found.')
		if (parlay.status !== 'pending') {
			throw new Error('Mock parlay is already terminal.')
		}
		if (!TERMINAL_RESULTS.has(result)) {
			throw new Error(`Unsupported mock parlay result: ${result}.`)
		}
		const leg = parlay.legs.find(
			(candidate) => candidate.outcome_uuid === outcomeUuid,
		)
		if (!leg) throw new Error('Mock parlay leg was not found.')
		if (leg.result !== 'pending') {
			throw new Error('Mock parlay leg is already settled.')
		}

		const legs = parlay.legs.map((candidate) =>
			candidate.outcome_uuid === outcomeUuid
				? { ...candidate, result, settled_at: new Date().toISOString() }
				: candidate,
		)
		const next: ParlayResponse = { ...parlay, legs }
		if (legs.some((candidate) => candidate.result === 'lost')) {
			next.status = 'lost'
			next.actual_payout = 0
			next.settled_at = new Date().toISOString()
		} else if (legs.some((candidate) => candidate.result === 'pending')) {
			this.parlays.set(parlayId, next)
			return next
		} else {
			const winningLegs = legs.filter(
				(candidate) => candidate.result === 'won',
			)
			next.status = winningLegs.length > 0 ? 'won' : 'push_refunded'
			next.actual_payout =
				winningLegs.length > 0
					? this.roundCurrency(
							parlay.stake *
								winningLegs.reduce(
									(product, candidate) =>
										product *
										this.decimalOdds(
											candidate.odds_american,
										),
									1,
								),
						)
					: parlay.stake
			next.settled_at = new Date().toISOString()
		}

		if ((next.actual_payout ?? 0) > 0) {
			this.store.credit(parlay.user_id, next.actual_payout ?? 0)
		}
		this.parlays.set(parlayId, next)
		this.notifyTerminal(next)
		return next
	}

	getEventOutcomes(sport: string, eventId: string): EventOutcome[] {
		const game = this.findGameById(eventId)
		if (!game?.home_team || !game.away_team) return []
		const context = {
			home_team: game.home_team,
			away_team: game.away_team,
		}
		return [
			{
				uuid: `${eventId}-home`,
				event_id: eventId,
				market_key: 'h2h',
				name: game.home_team,
				price: -110,
				position: 'home',
				outcome_type: 'team_home',
				event_context: context,
			},
			{
				uuid: `${eventId}-away`,
				event_id: eventId,
				market_key: 'h2h',
				name: game.away_team,
				price: 100,
				position: 'away',
				outcome_type: 'team_away',
				event_context: context,
			},
			{
				uuid: `${eventId}-spread-home`,
				event_id: eventId,
				market_key: 'spreads',
				name: game.home_team,
				price: -110,
				point: -1.5,
				position: 'home',
				outcome_type: 'team_home',
				event_context: context,
			},
			{
				uuid: `${eventId}-spread-away`,
				event_id: eventId,
				market_key: 'spreads',
				name: game.away_team,
				price: 100,
				point: 1.5,
				position: 'away',
				outcome_type: 'team_away',
				event_context: context,
			},
			{
				uuid: `${eventId}-total-over`,
				event_id: eventId,
				market_key: 'totals',
				name: 'Over',
				price: -110,
				point: 220.5,
				outcome_type: 'over',
				event_context: context,
			},
			{
				uuid: `${eventId}-total-under`,
				event_id: eventId,
				market_key: 'totals',
				name: 'Under',
				price: -110,
				point: 220.5,
				outcome_type: 'under',
				event_context: context,
			},
		]
	}

	clearPendingBets(request: ClearPendingBetsRequest) {
		this.store.clearPending(request.userid)
		return { statusCode: 200, message: 'Mock pending bet cleared' }
	}

	doubleDownBet(request: DoubleDownBetRequest): DoubleDownDto {
		const bet = this.store
			.getBets(request.userId)
			.find((item) => item.betid === request.betId)
		if (!bet) {
			throw new Error(`Mock bet ${request.betId} was not found`)
		}

		const newBalance = this.store.debit(request.userId, bet.amount)
		const nextBet = {
			...bet,
			amount: bet.amount * 2,
			profit: (bet.profit ?? 0) * 2,
			payout: (bet.payout ?? 0) * 2,
			newBalance,
		}
		this.store.updateBet(request.userId, request.betId, nextBet)

		return {
			status: 200,
			message: 'Mock bet doubled down',
			betslip: {
				newBetAmount: nextBet.amount,
				newProfit: nextBet.profit ?? 0,
				newPayout: nextBet.payout ?? 0,
				newBalance,
				userid: request.userId,
				betId: request.betId,
				isNewUser: false,
			},
		}
	}

	createAccount(userId: string): Account {
		const balance = this.store.getBalance(userId)
		this.store.setBalance(userId, balance)
		return {
			userid: userId,
			lastclaimtime: null,
			registerdate: new Date().toISOString(),
			monies: {
				id: `mock-monies-${userId}`,
				balance,
			} as Account['monies'],
			xp: { userid: userId, xp: 0, level: 1 } as Account['xp'],
			pending_betslip: null,
			claimstoday: 0,
		}
	}

	getAccountBalance(userId: string): GetBalanceDto {
		return {
			statusCode: 200,
			balance: this.store.getBalance(userId),
			userid: userId,
			isNewUser: false,
		}
	}

	getProfile(userId: string): GetProfileDto {
		return {
			statusCode: 200,
			userid: userId,
			balance: this.store.getBalance(userId),
			level: 1,
			tier: 'rookie',
			isNewUser: false,
		}
	}

	processClaim(userId: string): GetBalanceDto {
		const balance = this.store.credit(userId, 500)
		return {
			statusCode: 200,
			balance,
			userid: userId,
			isNewUser: false,
		}
	}

	getLeaderboard(): GetLeaderboardDto[] {
		return []
	}

	setBalance(userId: string, balance: number): number {
		return this.store.setBalance(userId, balance)
	}

	reset(): void {
		this.store.reset()
		this.matchesBySport.clear()
		this.nextBetId = 10_000
		this.nextParlayId = 20_000
		this.pendingParlays.clear()
		this.parlays.clear()
		this.terminalListeners.clear()
	}

	private validateParlayRequest(request: InitParlayRequest): void {
		if (
			!Array.isArray(request.legs) ||
			request.legs.length < PARLAY_MIN_LEGS ||
			request.legs.length > PARLAY_MAX_LEGS
		) {
			throw new Error(
				`Parlays must contain between ${PARLAY_MIN_LEGS} and ${PARLAY_MAX_LEGS} legs.`,
			)
		}
		if (
			!Number.isFinite(request.stake) ||
			request.stake < PARLAY_MIN_STAKE ||
			request.stake > PARLAY_MAX_STAKE
		) {
			throw new Error(
				`Parlay stake must be between ${PARLAY_MIN_STAKE} and ${PARLAY_MAX_STAKE}.`,
			)
		}
		if (
			new Set(request.legs.map((leg) => leg.event_id)).size !==
			request.legs.length
		) {
			throw new Error('Parlay legs must reference distinct events.')
		}
	}

	private marketKeyForOutcome(
		outcomeUuid: string,
	): 'h2h' | 'spreads' | 'totals' {
		if (outcomeUuid.includes('-spread-')) return 'spreads'
		if (outcomeUuid.includes('-total-')) return 'totals'
		if (outcomeUuid.endsWith('-home') || outcomeUuid.endsWith('-away')) {
			return 'h2h'
		}
		throw new Error(`Market in outcome ${outcomeUuid} is not supported.`)
	}

	private decimalOdds(american: number): number {
		return american >= 0 ? 1 + american / 100 : 1 + 100 / Math.abs(american)
	}

	private roundCurrency(value: number): number {
		return Math.round((value + Number.EPSILON) * 100) / 100
	}

	private notifyTerminal(parlay: ParlayResponse): void {
		for (const listener of this.terminalListeners) {
			listener({
				...parlay,
				legs: parlay.legs.map((leg) => ({ ...leg })),
			})
		}
	}

	private findGameForBet(
		sport: MockSport,
		gameId: string | undefined,
		team: string,
	): GetAllMatchesDto['matches'][number] {
		const matches = this.getMatchesForSport({ sport }).matches
		return (
			(gameId
				? matches.find((match) => match.id === gameId)
				: undefined) ??
			matches.find(
				(match) =>
					match.home_team?.toLowerCase() === team.toLowerCase() ||
					match.away_team?.toLowerCase() === team.toLowerCase(),
			) ??
			makeUpcomingGame({ sport })
		)
	}

	private findGameById(
		id: string,
	): GetAllMatchesDto['matches'][number] | undefined {
		return [...this.matchesBySport.values()]
			.flat()
			.find((match) => match.id === id)
	}
}
