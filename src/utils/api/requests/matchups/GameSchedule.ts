import { TextChannel } from 'discord.js'
import {
	dailyScheduleEmbed,
	scheduleGameLine,
} from '../../../../lib/discord/builders/odds.js'
import GuildUtils from '../../../guilds/GuildUtils.js'
import { AxiosKhronosInstance } from '../../common/axios-config.js'
import { OutgoingEndpoints } from '../../common/endpoints.js'
import type {
	IConfigRow,
	IMatchupAggregated,
	SportsServing,
} from '../../common/interfaces/kh-pluto/kh-pluto.interface.js'

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
		return { scheduleEmbed: dailyScheduleEmbed(desc) }
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
		// Fetch the schedule, format it
		const gamesStr = await this.parseAndFormat(games)
		const { scheduleEmbed } = await this.createScheduleEmbed(gamesStr)
		// Send the schedule to every daily_schedule channel
		for (const row of rows) {
			const chanId = row.setting_value
			const guildId = row.guild_id
			try {
				const chan = await new GuildUtils().getChanViaGuild({
					guildId,
					chanId,
				})
				if (!chan) {
					throw new Error('Failed to locate channel')
				}
				if (chan instanceof TextChannel) {
					await chan.send({ embeds: [scheduleEmbed] })
				}
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
		let games: IMatchupAggregated[] = []
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
		const homeTeamEmojiPromise = await new GuildUtils().findEmoji(
			game.home_team,
		)
		const awayTeamEmojiPromise = await new GuildUtils().findEmoji(
			game.away_team,
		)

		const [homeTeamEmojiResult, awayTeamEmojiResult] = await Promise.all([
			homeTeamEmojiPromise,
			awayTeamEmojiPromise,
		])

		return scheduleGameLine(game, {
			home: homeTeamEmojiResult,
			away: awayTeamEmojiResult,
		})
	}

	async reqAll() {
		const reqGamesSched = await this.axiosKhronosInstance({
			method: 'get',
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
