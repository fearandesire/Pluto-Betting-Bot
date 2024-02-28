export interface IMatchTeam {
	name: string
	odds: string
}

export interface IMatchupTeamOdds {
	home_team: IMatchTeam
	away_team: IMatchTeam
}

export interface IOddsField {
	teams: IMatchupTeamOdds
	dates: {
		mdy: string
		start: string
		legible: string
	}
}

export interface IMatchupsGrouped {
	[key: string]: IOddsField[]
}
