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
	UserParlaysResponse,
} from '../api/Khronos/parlays/ParlayApiWrapper.js'
import {
	makeBetslipWithAggregation,
	makePlacedBetslip,
} from './factories/betslips.js'
import { makeMatchesForSport, makeUpcomingGame } from './factories/games.js'
import { asMockSport, MOCK_SPORTS, type MockSport } from './factories/teams.js'
import { MockStore } from './mock-store.js'

export class MockBackend {
	private static backend: MockBackend | undefined
	private readonly store = new MockStore()
	private readonly matchesBySport = new Map<
		MockSport,
		GetAllMatchesDto['matches']
	>()
	private nextBetId = 10_000
	private nextParlayId = 20_000
	private readonly pendingParlays = new Map<
		string,
		{ request: InitParlayRequest; preview: InitParlayResponse }
	>()
	private readonly parlays = new Map<string, ParlayResponse>()

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
		const legs = request.legs.map((leg) => {
			const market_key = leg.outcome_uuid.includes('-spread-')
				? ('spreads' as const)
				: leg.outcome_uuid.includes('-total-')
					? ('totals' as const)
					: ('h2h' as const)
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
		const decimal = Math.pow(210 / 110, legs.length)
		const preview: InitParlayResponse = {
			init_token: randomUUID(),
			combined_odds_american: Math.round((decimal - 1) * 100),
			potential_payout: Math.round(request.stake * decimal * 100) / 100,
			legs,
			expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
		}
		this.pendingParlays.set(preview.init_token, { request, preview })
		return preview
	}

	placeParlay(initToken: string): ParlayResponse {
		const pending = this.pendingParlays.get(initToken)
		if (!pending) throw new Error('Mock parlay initialization expired.')
		this.pendingParlays.delete(initToken)
		const { request, preview } = pending
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
		const cancelled = { ...parlay, status: 'cancelled' as const }
		this.parlays.set(parlayId, cancelled)
		return cancelled
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
