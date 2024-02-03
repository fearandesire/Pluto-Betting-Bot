import { SportsServing } from '../../interfaces/interfaces'

export interface IChannelAPI {
	id: string
	sport: string
	channelname: string
	crontime: string
	gametime: string
	created: boolean
}

export interface IChannelAggregated {
	id: string
	sport: SportsServing
	channelname: string
	crontime: string
	gametime: string
	created: boolean
	matchupOdds: {
		favored: string
		home_team_odds: number
		away_team_odds: number
	}
	home_team: string
	away_team: string
}
