import { faker } from '@faker-js/faker'
import type {
	BetslipWithAggregationDTO,
	GetAllMatchesDtoMatchesInner,
	PlaceBetDto,
	PlacedBetslip,
} from '@kh-openapi'
import { PlacedBetslipBetresultEnum } from '../../../openapi/khronos/index.js'
import { makeUpcomingGame } from './games.js'
import { asMockSport } from './teams.js'

export function calculateProfit(amount: number, odds: number): number {
	const profit =
		odds > 0 ? amount * (odds / 100) : amount * (100 / Math.abs(odds))
	return Number(profit.toFixed(2))
}

function selectedOdds(
	game: GetAllMatchesDtoMatchesInner,
	team: string,
): number {
	if (game.home_team?.toLowerCase() === team.toLowerCase()) {
		return game.home_team_odds ?? -130
	}
	return game.away_team_odds ?? 110
}

function opponentFor(game: GetAllMatchesDtoMatchesInner, team: string): string {
	if (game.home_team?.toLowerCase() === team.toLowerCase()) {
		return game.away_team ?? 'Away Team'
	}
	return game.home_team ?? 'Home Team'
}

export function makeBetslipWithAggregation(options: {
	userId: string
	team: string
	amount: number
	sport: string
	game?: GetAllMatchesDtoMatchesInner
}): BetslipWithAggregationDTO {
	const game =
		options.game ??
		makeUpcomingGame({
			sport: asMockSport(options.sport),
		})
	const odds = selectedOdds(game, options.team)
	const profit = calculateProfit(options.amount, odds)

	return {
		userid: options.userId,
		team: options.team,
		amount: options.amount,
		profit,
		payout: Number((options.amount + profit).toFixed(2)),
		opponent: opponentFor(game, options.team),
		dateofmatchup: game.commence_time ?? new Date().toISOString(),
		match: {
			id: game.id,
			sport: game.sport,
			sport_title: game.sport_title,
			home_team: game.home_team,
			away_team: game.away_team,
			commence_time: game.commence_time,
			home_team_odds: game.home_team_odds,
			away_team_odds: game.away_team_odds,
			status: game.status,
		},
		isNewUser: false,
	}
}

export function makePlacedBetslip(options: {
	placeBetDto: PlaceBetDto
	game?: GetAllMatchesDtoMatchesInner
	newBalance: number
	betId?: number
}): PlacedBetslip {
	const game =
		options.game ??
		makeUpcomingGame({
			sport: 'nba',
			id: options.placeBetDto.matchup_id,
		})
	const odds = selectedOdds(game, options.placeBetDto.team)
	const profit = calculateProfit(options.placeBetDto.amount, odds)

	return {
		betid: options.betId ?? faker.number.int({ min: 10_000, max: 99_999 }),
		userid: options.placeBetDto.userid,
		team: options.placeBetDto.team,
		matchup_id: options.placeBetDto.matchup_id,
		amount: options.placeBetDto.amount,
		profit,
		payout: Number((options.placeBetDto.amount + profit).toFixed(2)),
		betresult: PlacedBetslipBetresultEnum.Pending,
		dateofbet: new Date().toISOString(),
		guild_id: options.placeBetDto.guild_id,
		newBalance: options.newBalance,
		isNewUser: false,
		dateofmatchup: game.commence_time ?? new Date().toISOString(),
	}
}
