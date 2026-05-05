import type {
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
} from '@kh-openapi'
import { DEV_IDS } from '../../lib/configs/constants.js'
import env from '../../lib/startup/env.js'
import {
	DiscordConfigSettingTypeEnum,
	PlacedBetslipBetresultEnum,
} from '../../openapi/khronos/index.js'
import { DiscordConfigEnums } from '../api/common/interfaces/kh-pluto/kh-pluto.interface.js'
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
			.filter((bet) => bet.betresult === PlacedBetslipBetresultEnum.Pending)
	}

	getUserBetslips(request: GetUserBetslipsRequest): PlacedBetslip[] {
		return this.store.getBets(request.userid)
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

	createAccount(userId: string): GetProfileDto {
		this.store.setBalance(userId, this.store.getBalance(userId))
		return this.getProfile(userId)
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
