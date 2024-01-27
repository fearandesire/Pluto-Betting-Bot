import axios from 'axios'
import { SapDiscClient } from '@pluto-core'
import PlutoLogger from '@pluto-logger'
import { Log } from '@pluto-internal-logger'
import { addMinutes, format } from 'date-fns'
import cron from 'node-cron'
import {resolveTeam} from 'resolve-team'
import _ from 'lodash'
import discord, {
	CategoryChannelResolvable,
	ColorResolvable,
	EmbedBuilder,
} from 'discord.js'
import { pluto_api_url } from '../../serverConfig.js'
import { getCategories } from '../../api/utils/getCategories.js'
import { findEmoji } from '../../bot_res/findEmoji.js'
import { IChannelAggregatedAPI } from 'utils/api/routes/channels/createchannels.interface.js'
import { IConfigRow } from 'lib/interfaces/api/ApiInterfaces.js'

const { ChannelType } = discord

interface IPrepareMatchEmbed {
	favored: string
	favoredTeamClr: ColorResolvable
	home_team: string
	away_team: string
	bettingChanId: string
}
/**
 * Handle interactions between Pluto API & Discord user interface/interactions
 */
export default class ChannelManager {
	private serverId: string
	private API_URL: string
	private ep: {
		gchan: string
	}

	constructor(guildId: string) {
		this.serverId = guildId
		this.API_URL = `${pluto_api_url}`
		this.ep = {
			gchan: `/channels`,
		}
	}

	/**
	 * Processes each channel and handles creation and embed sending.
	 * @async
	 * @param {Object} channel - The channel data to process.
	 * @param {Array} bettingChanRows - Array of betting channel data.
	 */
	async processChannel(
		channel: IChannelAggregatedAPI,
		bettingChanRows: IConfigRow[],
	) {
		const { matchupOdds } = channel
		const { favored } = matchupOdds
		const favoredTeamInfo = await resolveTeam(favored, {
			sport: channel.sport.toLowerCase(),
			full: true,
		})
		this.validateFavoredTeamInfo(favoredTeamInfo)
		const gameCategories = await getCategories()
		if (!gameCategories) throw new Error(`Could not get categories.`)

		for (const category of gameCategories) {
			await this.createChannelAndSendEmbed(
				channel,
				category,
				bettingChanRows,
				favoredTeamInfo,
			)
		}
	}

	/**
	 * Validates the resolved team information.
	 * @param {Object} favoredTeamInfo - The resolved team data.
	 * @throws {Error} If team colors or data are unavailable.
	 */
	validateFavoredTeamInfo(favoredTeamInfo: any) {
		if (!favoredTeamInfo || _.isEmpty(favoredTeamInfo.colors)) {
			throw new Error('Unable to resolve team colors or data')
		}
	}

	/**
	 * Creates a channel and sends an embed message to it.
	 * @async
	 * @param {Object} channel - Channel data.
	 * @param {Object} configRow - Category data.
	 * @param {Array} bettingChanRows - Array of betting channel data.
	 * @param {Object} favoredTeamInfo - Resolved team information.
	 */
	async createChannelAndSendEmbed(
		channel: IChannelAggregatedAPI,
		configRow: IConfigRow,
		bettingChanRows: IConfigRow[],
		favoredTeamInfo: any,
	) {
		const guild = SapDiscClient.guilds.cache.get(configRow.guild_id)

		if (!guild) return null

		const guildsCategory = guild.channels.cache.get(
			`${configRow.setting_value}`,
		)
		const sortedBetChan = bettingChanRows.find(
			(row) => row.guild_id === guild.id,
		)

		const bettingChanId = sortedBetChan?.setting_value
		const { home_team, away_team } = channel
		if (_.isEmpty(home_team) || _.isEmpty(away_team)) {
			throw new Error(`Missing home and away teams in channel data.`)
		}
		if (!bettingChanId) {
			throw new Error(`Missing betting channel id in channel data.`)
		}

		const { matchupOdds } = channel
		const args = {
			favored: matchupOdds.favored,
			favoredTeamClr: favoredTeamInfo.colors[0],
			home_team,
			away_team,
			bettingChanId,
		}
		const matchEmbed = await this.prepareMatchupEmbed(args)

		const gameChan = await guild.channels.create({
			name: `${channel.channelname}`,
			type: ChannelType.GuildText,
			topic: `Enjoy the Game!`,
			parent: guildsCategory as CategoryChannelResolvable,
		})

		await gameChan.send({ embeds: [matchEmbed.embed] })
		console.log(`Created channel: ${channel.channelname} `)
	}

	async prepareMatchupEmbed(args: IPrepareMatchEmbed) {
		const embedClr = args.favoredTeamClr
		const teamEmoji = (await findEmoji(args.favored)) || ''
		const title = `${args.away_team} @ ${args.home_team}`

		const matchEmbed = new EmbedBuilder()
			.setColor(embedClr)
			.setTitle(title)
			.setDescription(
				`
**The ${teamEmoji} ${args.favored} are favored to win this game!**

*Type \`/commands\` in the <#${args.bettingChanId}> channel to place bets with Pluto*`,
			)
			.setFooter({
				text: `Pluto | Created by fenixforever`,
			})

		return { embed: matchEmbed }
	}

	async locateChannel(serverid: string, channelName: string) {
		// Find channel in guild
		const guild = await SapDiscClient.guilds.cache.get(`${serverid}`)

		if (!guild) {
			return false
		}
		const channel = await guild.channels.cache.find(
			(GC) => GC.name.toLowerCase() === channelName.toLowerCase(),
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

	async deleteChan(channelName: string) {
		// Replace spaces with -
		const parsedChanName = channelName.replace(/\s/g, '-')
		const gameChan = await this.locateChannel(this.serverId, channelName)
		if (!gameChan) {
			await Log.Red(
				`Unable to locate channel \`${parsedChanName}\` to delete.`,
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
	async queueDeleteChannel(gameChanName: string, id: string) {
		const rn = new Date()
		const currMin = addMinutes(rn, 5) // format current time + x minutes
		const newMinRaw = format(currMin, 's mm H d M i')
		const splitTime = newMinRaw.split(' ')
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
				await this.deleteChan(gameChanName).then(async (res) => {
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
				})
			} catch (error: any) {
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

	async deleteFromAPI(id: string) {
		return axios.delete(`${this.API_URL}/${this.ep.gchan}/${id}`, {
			headers: {
				'admin-token': `${process.env.PLUTO_API_TOKEN}`,
			},
		})
	}
}
