import axios from 'axios'
import { AttachmentBuilder, EmbedBuilder } from 'discord.js'
import { pluto_api_url } from '../../../serverConfig.js'
import { findEmoji } from '../../../bot_res/findEmoji.js'
import embedColors from '../../../../lib/colorsConfig.js'
import GuiltUtils from '../../utils/GuildUtils.js'

/**
 * Responsible for retrieving & displaying upcoming games / matchups
 */
export default class GameSchedule {
	async createScheduleEmbed(desc) {
		// Make today's date string: `DD/MM/YYYY`
		const date = new Date()
		const today = date.toLocaleDateString('en-US', {
			month: '2-digit',
			day: '2-digit',
			year: 'numeric',
		})
		const scheduleEmbed = new EmbedBuilder()
			.setDescription(
				`## Daily Schedule | ${today}\n${desc}`,
			)
			.setColor(embedColors.PlutoRed)
			.setFooter({ text: `dev. fenixforever` })
		return { scheduleEmbed }
	}

	/**
	 * Formats and sends the games for the current day
	 */
	async sendDailyGames(sport, games, rows) {
		// Fetch the schedule, format it
		const gamesStr = await this.parseAndFormat(games)
		const { scheduleEmbed } =
			await this.createScheduleEmbed(gamesStr)
		// Send the schedule to every daily_schedule channel
		for (const row of rows) {
			const chanId = row.setting_value
			const guildId = row.guild_id
			try {
				const chan =
					await new GuiltUtils().getChanViaGuild({
						guildId,
						chanId,
					})
				await chan.send({ embeds: [scheduleEmbed] })
			} catch (err) {
				console.error(err)
				continue
			}
		}
	}

	async parseAndFormat(games) {
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

	/**
	 * Query Khronos API
	 * Get games for today
	 * Parse & Format into a conjoined string detailing the matchups schedule for today
	 * @returns {string}
	 */
	async getFormattedSchedule(sport) {
		let games
		if (!sport) {
			games = await this.reqAll() // Fetches schedule
		} else {
			games = await this.fetchViaSport(sport)
		}
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
		const [homeTeamShort, awayTeamShort] = [
			game.home_team,
			game.away_team,
		].map((name) => name.split(' ').pop())
		const [homeTeamEmoji, awayTeamEmoji] =
			await Promise.all([
				GuiltUtils.findEmoji(game.home_team),
				GuiltUtils.findEmoji(game.away_team),
			])

		const unixTimestamp = Math.floor(
			new Date(game.commence_time).getTime() / 1000,
		)
		return `**${awayTeamEmoji} ${awayTeamShort} *(${game.teamRecords[1]})*** *\`at\`* **${homeTeamEmoji} ${homeTeamShort} *(${game.teamRecords[0]})*** @ *<t:${unixTimestamp}:t>*`
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
