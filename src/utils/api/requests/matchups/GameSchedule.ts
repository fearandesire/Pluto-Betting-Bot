import { ColorResolvable, EmbedBuilder } from 'discord.js'
import embedColors from '../../../../lib/colorsConfig.js'
import GuiltUtils from '../../utils/GuildUtils.js'
import {
	IConfigRow,
	IMatchupAggregated,
	SportsServing,
} from '../../interfaces/interfaces.js'
import { OutgoingEndpoints } from '../../common/endpoints.js'
import { AxiosKhronosInstance } from '../../common/axios-config.js'

/**
 * Responsible for retrieving & displaying upcoming games / matchups
 */
export default class GameSchedule {
	private readonly outRoutes = OutgoingEndpoints.paths
	private readonly axiosKhronosInstance = AxiosKhronosInstance
	constructor() {
		this.outRoutes = OutgoingEndpoints.paths
		this.axiosKhronosInstance = AxiosKhronosInstance
	}

	async fetchViaSport(sport: SportsServing) {
		const gamesArr = await this.reqAll()
		// Remove any that don't have the `sport` as their `sport_title`
		return this.filterBySport(gamesArr, sport)
	}

	async createScheduleEmbed(desc: string) {
		// Make today's date string: `DD/MM/YYYY`
		const date = new Date()
		const today = date.toLocaleDateString('en-US', {
			month: '2-digit',
			day: '2-digit',
			year: 'numeric',
		})
		const scheduleEmbed = new EmbedBuilder()
			.setDescription(`## Daily Schedule | ${today}\n${desc}`)
			.setColor(embedColors.PlutoRed as ColorResolvable)
			.setFooter({ text: `dev. fenixforever` })
		return { scheduleEmbed }
	}

	/**
	 * @summary Formats and sends the games for the current day
	 *
	 * Games are sent to every guild we have subscribed for scheduled game posts
	 *
	 * Sent directly to the specified `DAILY_CHANNEL` for the guild
	 */
	async sendDailyGames(
		sport: string,
		games: IMatchupAggregated[],
		rows: IConfigRow[],
	) {
		console.log(sport)
		// Fetch the schedule, format it
		const gamesStr = await this.parseAndFormat(games)
		const { scheduleEmbed } = await this.createScheduleEmbed(gamesStr)
		// Send the schedule to every daily_schedule channel
		for (const row of rows) {
			const chanId = row.setting_value
			const guildId = row.guild_id
			try {
				const chan = await new GuiltUtils().getChanViaGuild({
					guildId,
					chanId,
				})
				await chan.send({ embeds: [scheduleEmbed] })
			} catch (err) {
				console.error(err)
			}
		}
	}

	async parseAndFormat(games: IMatchupAggregated[]) {
		let scheduleStr = ''
		for (const game of games) {
			const formattedGame = await this.formatForSchedule(game)
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
	 * 1. Retrieve matches for today
	 * 2. Parse and format
	 * 3. Returns the formatted scheduled games
	 */
	async getFormattedSchedule(sport: SportsServing) {
		let games
		if (!sport) {
			games = await this.reqAll() // Fetches schedule
		} else {
			games = await this.fetchViaSport(sport)
		}
		let scheduleStr = ''

		for (const game of games) {
			const formattedGame = await this.formatForSchedule(game)
			scheduleStr += `${formattedGame}\n` // Append each game's string

			// Validate Discord Embed limit
			if (scheduleStr.length > 4096) {
				// WIP | Need a solution for pages in this new system
				scheduleStr += '... and more!'
				break
			}
		}

		return scheduleStr
	}

	/**
	 * @summary Formats the string for a matchup
	 * 
	 * 	The goal formatted text is:
	`Away Team (record) at Home Team (record) @ 8:00 PM (legibletime)
	`
	 *
	 */
	async formatForSchedule(game: IMatchupAggregated) {
		const [homeTeamShort, awayTeamShort] = [
			game.home_team,
			game.away_team,
		].map((name) => name.split(' ').pop())
		const [homeTeamEmoji, awayTeamEmoji] = await Promise.all([
			GuiltUtils.findEmoji(game.home_team),
			GuiltUtils.findEmoji(game.away_team),
		])

		const unixTimestamp = Math.floor(
			new Date(game.commence_time).getTime() / 1000,
		)
		return `**${awayTeamEmoji} ${awayTeamShort} *(${game.teamRecords[1]})*** *\`at\`* **${homeTeamEmoji} ${homeTeamShort} *(${game.teamRecords[0]})*** @ *<t:${unixTimestamp}:t>*`
	}

	async reqAll() {
		const reqGamesSched = await this.axiosKhronosInstance({
			method: `get`,
			url: `${this.outRoutes.matches.getAll}`,
		})
		return reqGamesSched.data
	}

	async filterBySport(gamesArr: IMatchupAggregated[], sport: SportsServing) {
		return gamesArr.filter(
			(game) => game.sport_title.toLowerCase() === sport.toLowerCase(),
		)
	}
}