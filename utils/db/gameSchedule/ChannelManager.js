import axios from 'axios'
import { SapDiscClient } from '@pluto-core'
import PlutoLogger from '@pluto-logger'
import { Log } from '@pluto-internal-logger'
import { addMinutes, format } from 'date-fns'
import cron from 'node-cron'
import teamResolver from 'resolve-team'
import _ from 'lodash'
import discord, { EmbedBuilder } from 'discord.js'
import AuthManager from '../../api/auth/AuthManager.js'
import { pluto_api_url } from '../../serverConfig.js'
import { getCategories } from '../../api/utils/getCategories.js'
import { findEmoji } from '../../bot_res/findEmoji.js'

const { ChannelType } = discord

/**
 * Handle interactions between Pluto API & Discord user interface/interactions
 */
export default class ChannelManager {
	constructor(guildId) {
		this.serverId = guildId
		this.API_URL = `${pluto_api_url}`
		this.ep = {
			gchan: `/channels`,
		}
		this.authManager = new AuthManager()
	}

	/**
	 * Processes each channel and handles creation and embed sending.
	 * @async
	 * @param {Object} channel - The channel data to process.
	 * @param {Array} bettingChanRows - Array of betting channel data.
	 */
	async processChannel(channel, bettingChanRows) {
		const { matchupOdds } = channel
		const { favored } = matchupOdds
		const favoredTeamInfo = await teamResolver(
			channel.sport.toLowerCase(),
			favored,
			{ full: true },
		)
		this.validateFavoredTeamInfo(favoredTeamInfo)
		const categoriesData = await getCategories()
		if (!categoriesData)
			throw new Error(`Could not get categories.`)

		for (const category of categoriesData) {
			await this.createChannelAndSendEmbed(
				channel,
				category,
				bettingChanRows,
				favoredTeamInfo,
			)
		}
	}

	/**
	 * Schedules channels based on the data received from the API.
	 */
	async scheduleChannelsFromAPI() {
		try {
			const channelData = (await this.reqChannels())
				.data
			if (!Array.isArray(channelData)) {
				console.error('Invalid channel data format')
				return false
			}

			for (const channel of channelData) {
				const args = {
					scheduledCreationTime: channel.crontime,
					chanName: channel.channelname,
					createNow: false, // Set to false by default
				}

				const { awayTeam, homeTeam } =
					this.sortHomeVsAway(args.chanName)
				const success = await this.scheduleChannels(
					homeTeam,
					awayTeam,
					args,
				)
				if (!success) {
					console.error(
						`Failed to schedule channel: ${args.chanName}`,
					)
				}
			}

			console.log(
				'All channels scheduled successfully',
			)
			return true
		} catch (error) {
			console.error(
				'Error in scheduling channels from API:',
				error,
			)
			return false
		}
	}

	/**
	 * Validates the resolved team information.
	 * @param {Object} favoredTeamInfo - The resolved team data.
	 * @throws {Error} If team colors or data are unavailable.
	 */
	validateFavoredTeamInfo(favoredTeamInfo) {
		if (
			!favoredTeamInfo ||
			_.isEmpty(favoredTeamInfo.colors)
		) {
			throw new Error(
				'Unable to resolve team colors or data',
			)
		}
	}

	/**
	 * Creates a channel and sends an embed message to it.
	 * @async
	 * @param {Object} channel - Channel data.
	 * @param {Object} category - Category data.
	 * @param {Array} bettingChanRows - Array of betting channel data.
	 * @param {Object} favoredTeamInfo - Resolved team information.
	 */
	async createChannelAndSendEmbed(
		channel,
		category,
		bettingChanRows,
		favoredTeamInfo,
	) {
		const guild = SapDiscClient.guilds.cache.get(
			category.guild_id,
		)
		const guildsCategory = guild.channels.cache.get(
			`${category.setting_value}`,
		)
		const sortedBetChan = bettingChanRows.find(
			(row) => row.guild_id === guild.id,
		)

		const bettingChanId = sortedBetChan?.setting_value
		const { home_team, away_team } = channel
		if (_.isEmpty(home_team) || _.isEmpty(away_team)) {
			throw new Error(
				`Missing home and away teams in channel data.`,
			)
		}

		const { matchupOdds } = channel

		const matchEmbed = await this.prepareMatchupEmbed({
			favored: matchupOdds.favored,
			favoredTeamClr: favoredTeamInfo.colors[0],
			home_team,
			away_team,
			bettingChanId,
		})

		const gameChan = await guild.channels.create({
			name: `${channel.channelname}`,
			type: ChannelType.GuildText,
			topic: `Enjoy the Game!`,
			parent: guildsCategory,
		})

		await gameChan.send({ embeds: [matchEmbed.embed] })
		console.log(
			`Created channel: ${channel.channelname} `,
		)
	}

	async prepareMatchupEmbed({
		favored,
		favoredTeamClr,
		home_team,
		away_team,
		bettingChanId,
	}) {
		const embedClr = favoredTeamClr
		const teamEmoji = (await findEmoji(favored)) || ''
		const title = `${away_team} @ ${home_team}`

		const matchEmbed = new EmbedBuilder()
			.setColor(embedClr)
			.setTitle(title)
			.setDescription(
				`
**The ${teamEmoji} ${favored} are favored to win this game!**

*Type \`/commands\` in the <#${bettingChanId}> channel to place bets with Pluto*`,
			)
			.setFooter({
				text: `Pluto | Created by fenixforever`,
			})

		return { embed: matchEmbed }
	}

	async locateChannel(serverid, channelName) {
		// Find channel in guild
		const guild = await SapDiscClient.guilds.cache.get(
			`${serverid}`,
		)

		if (!guild) {
			return false
		}
		const channel = await guild.channels.cache.find(
			(GC) =>
				GC.name.toLowerCase() ===
				channelName.toLowerCase(),
		)
		if (!channel) {
			return false
		}
		return channel
	}

	/**
	 * @module deleteChan
	 * Locate the game channel via the name and delete it
	 * @param {string} channelName - The name of the channel to locate
	 * @returns {object} - The channel object, or false if not found
	 */

	async deleteChan(channelName) {
		// Replace spaces with -
		const parsedChanName = channelName.replace(
			/\s/g,
			'-',
		)
		const gameChan = await this.locateChannel(
			this.serverId,
			channelName,
		)
		if (!gameChan) {
			await Log.Red(
				`Unable to locate channel \`${parsedChanName}\` to delete.`,
				`#ff0000`,
			)
			return false
		}
		await gameChan.delete()
		return true
	}

	/**
	 * @module queueDeleteChannel
	 * Create a Cron Job to delete a channel 30 minutes from the current time.
	 * Removes game from the Pluto Channel API
	 * @param {string} gameChanName The name of the channel to delete
	 */
	async queueDeleteChannel(gameChanName, id) {
		const rn = new Date()
		const currMin = addMinutes(rn, 5) // format current time + x minutes
		const newMinRaw = format(currMin, 's mm H d M i')
		const splitTime = newMinRaw.split(' ')
		// eslint-disable-next-line no-unused-vars
		const secs = splitTime[0]
		const mins = splitTime[1]
		const hours = splitTime[2]
		const day = splitTime[3]
		const month = splitTime[4]
		const dayOfWeek = splitTime[5]
		const cronString = `0 ${mins} ${hours} ${day} ${month} ${dayOfWeek}`
		await PlutoLogger.log({
			id: 2,
			description: `Deleting game channel ${gameChanName} in 5 minutes.`,
		})
		cron.schedule(cronString, async () => {
			try {
				await this.deleteChan(gameChanName).then(
					async (res) => {
						if (res) {
							await PlutoLogger.log({
								id: 2,
								description: `Deleted game channel ${gameChanName}`,
							})
							return true
						}
						await PlutoLogger.log({
							id: 2,
							description: `Failed to delete game channel ${gameChanName}\nThis channel was likely already deleted.`,
						})
						return false
					},
				)
			} catch (error) {
				await PlutoLogger.log({
					id: 2,
					description: `Failed to delete game channel ${gameChanName}\nError: ${error.message}`,
				})
			}
		})

		// ? Remove from Khronos API
		await this.deleteFromAPI(id)
		await console.log(`Removed ${id} from Khronos API`)
	}

	async deleteFromAPI(id) {
		return axios.delete(
			`${this.API_URL}/${this.ep.gchan}/${id}`,
			{
				headers: {
					'admin-token': `${process.env.PLUTO_API_TOKEN}`,
				},
			},
		)
	}

	/**
	 * Fetches the scheduled channels.
	 *
	 * @return {Promise<Array>} An array of channel data.
	 */
	async fetchScheduledChannels() {
		try {
			const channelsData = await this.reqChannels()
			return channelsData
		} catch (err) {
			console.error(err)
			return false
		}
	}

	async reqChannels() {
		const currentToken =
			await new AuthManager().getToken()
		const channelsQuery = axios.get(
			`${this.API_URL}/game-channel/all`,
			{
				params: {
					serverid: this.serverId,
				},
				headers: {
					Authorization: `Bearer ${currentToken}`,
				},
			},
		)
		return channelsQuery.data
	}
}
