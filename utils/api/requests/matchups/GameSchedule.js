import axios from 'axios'
import { pluto_api_url } from '../../../serverConfig.js'
import { findEmoji } from '../../../bot_res/findEmoji.js'

export default class GameSchedule {
	/**
	 * Query Khronos API
	 * Get games for today
	 */
	async getFormattedSchedule(sport) {
		const games = await this.fetchViaSport(sport)
		let scheduleStr = ''

		for (const game of games) {
			const formattedGame =
				await this.formatForSchedule(game)
			scheduleStr += `${formattedGame}\n` // Append each game's string

			// Check Discord character limit
			if (scheduleStr.length > 1950) {
				// Keeping some buffer
				scheduleStr += '... and more games'
				break
			}
		}

		return scheduleStr
	}

	async fetchViaSport(sport) {
		const gamesArr = await this.reqAll()

		// Remove any that don't have the `sport` as their `sport_title`
		const filteredGames = this.filterBySport(
			gamesArr,
			sport,
		)

		return filteredGames
	}

	/**
	 * @summary Formats the string for a matchup
	 * 
	 * 	The goal formatted text is:
	`Away Team (record) at Home Team (record) @ 8:00 PM (legibletime)
	`
	 * 
	 * Each game appears as:
	 ```ts
	 export interface IMatchupAggregated {
	id: string
	sport_title: string
	commence_time: string
	home_team: string
	away_team: string
	last_update: string
	home_team_odds: number
	away_team_odds: number
	winner: string | null
	loser: string | null
	dateofmatchup: string
	legiblestart: string
	cron_timer: string
	closing_bets: boolean
	broadcastInfo: string[]
	teamRecords: string[]
}
	```
	 */
	async formatForSchedule(game) {
		// Shorten team names (assuming they're in the format "City TeamName")
		const homeTeamShort = game.home_team
			.split(' ')
			.pop()
		const awayTeamShort = game.away_team
			.split(' ')
			.pop()
		const homeTeamEmoji =
			(await findEmoji(game.home_team)) || ''
		const awayTeamEmoji =
			(await findEmoji(game.away_team)) || ''
		const unixTimestamp = Math.floor(
			new Date(game.commence_time).getTime() / 1000,
		)

		// Format game string with bold team names and italic records
		const gameStr = `**${awayTeamEmoji} ${awayTeamShort} *(${game.teamRecords[1]})*** at **${homeTeamEmoji} ${homeTeamShort} *(${game.teamRecords[0]})*** @ *<t:${unixTimestamp}:t>*`
		return gameStr
	}

	async reqAll() {
		const reqGamesSched = await axios.get(
			`${pluto_api_url}/matchups/today`,
			{
				headers: {
					'admin-token': `${process.env.PLUTO_API_TOKEN}`,
				},
			},
		)
		return reqGamesSched.data
	}

	async filterBySport(gamesArr, sport) {
		return gamesArr.filter(
			(game) =>
				game.sport_title.toLowerCase() ===
				sport.toLowerCase(),
		)
	}
}
