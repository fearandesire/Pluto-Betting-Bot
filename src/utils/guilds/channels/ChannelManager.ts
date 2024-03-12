import { SapDiscClient } from '@pluto-core'
import { resolveTeam } from 'resolve-team'
import _ from 'lodash'
import {
	AttachmentBuilder,
	CategoryChannelResolvable,
	ChannelType,
	ColorResolvable,
	EmbedBuilder,
	Guild,
	GuildBasedChannel,
	MessageCreateOptions,
	TextChannel,
} from 'discord.js'
import { pluto_api_url } from '@pluto-server-config'
import { findEmoji } from '../../bot_res/findEmoji.js'
import { IChannelAggregated } from '../../api/routes/channels/createchannels.interface.js'
import {
	ICategoryData,
	IConfigRow,
} from '../../api/common/interfaces/common-interfaces.js'
import path from 'path'
import { fileURLToPath } from 'node:url'
import fs from 'fs/promises'

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
	private readonly API_URL: string
	private ep: {
		gchan: string
	}

	constructor() {
		this.API_URL = `${pluto_api_url}`
		this.ep = {
			gchan: `/channels`,
		}
	}

	/**
	 * Channel Creation
	 * Embed creation & Sending on channel creation
	 * @param {Object} channel - The channel data to process.
	 * @param {Array} betChanRows - Array of betting channel data.
	 * @param {Object} categoriesServing - Arrays of categories separated by sport.
	 * These are the categories that Pluto is serving,
	 * and is where we will be creating the channels.
	 */
	async processChannel(
		channel: IChannelAggregated,
		betChanRows: IConfigRow[],
		categoriesServing: ICategoryData,
	) {
		const { sport, matchupOdds } = channel
		const { favored } = matchupOdds
		const favoredTeamInfo = await resolveTeam(favored, {
			sport: sport.toLowerCase(),
			full: true,
		})
		this.validateFavoredTeamInfo(favoredTeamInfo)

		// ? Create channels by sport
		const gameCategories = categoriesServing[sport]
		if (!gameCategories || _.isEmpty(gameCategories)) {
			return
		}
		const matchImgStr = `${channel.away_team}_${channel.home_team}`
		const matchImg = await this.fetchVsImg(matchImgStr, sport)
		for (const gameCatRow of gameCategories) {
			await this.createChannelAndSendEmbed(
				channel,
				gameCatRow,
				betChanRows,
				favoredTeamInfo,
				matchImg,
			)
		}
	}

	/**
	 * Validates and parses incoming channel data from the request
	 * @async
	 * @returns {Array} Array of channel data objects.
	 * @throws {Error} If no channels data is received.
	 */
	async validateAndParseChannels(body: {
		channels: IChannelAggregated[]
		bettingChanRows: IConfigRow[]
	}) {
		if (_.isEmpty(body.channels) || _.isEmpty(body.bettingChanRows)) {
			return false
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
	 * @param {Buffer} matchImg - The image for the match
	 */
	async createChannelAndSendEmbed(
		channel: IChannelAggregated,
		configRow: IConfigRow,
		bettingChanRows: IConfigRow[],
		favoredTeamInfo: any,
		matchImg: Buffer | null,
	) {
		const guild: Guild = SapDiscClient.guilds.cache.get(
			configRow.guild_id,
		) as Guild

		if (!guild) return null

		// Prevent creating duplicate channels
		if (
			await guild.channels.cache.find(
				(GC) =>
					GC.name.toLowerCase() === channel.channelname.toLowerCase(),
			)
		) {
			return
		}

		const guildsCategory = guild.channels.cache.get(
			`${configRow.setting_value}`,
		)
		if (!guildsCategory) {
			return
		}

		// Locate the betting channel for the guild
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
		// Correctly create an AttachmentBuilder instance with the matchImg buffer
		let attachment = null
		if (matchImg) {
			attachment = new AttachmentBuilder(matchImg, { name: 'match.png' })
			matchEmbed.embed.setImage('attachment://match.png')
		}

		const gameChan = await guild.channels.create({
			name: `${channel.channelname}`,
			type: ChannelType.GuildText,
			topic: 'Enjoy the Game!',
			parent: guildsCategory as CategoryChannelResolvable,
		})

		// Check if the created channel is a TextChannel before using TextChannel-specific methods
		if (gameChan instanceof TextChannel) {
			const messageOptions: MessageCreateOptions = {
				embeds: [matchEmbed.embed],
			}
			// Only include 'files' property if attachment is not null
			if (attachment) {
				messageOptions['files'] = [attachment]
			}

			await gameChan.send(messageOptions)
			console.log(`Created channel: ${channel.channelname}`)
		} else {
			console.error('The created channel is not a TextChannel.')
		}
	}

	async prepareMatchupEmbed(args: IPrepareMatchEmbed) {
		const embedClr = args.favoredTeamClr
		const teamEmoji = (await findEmoji(args.favored)) ?? ''
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

	async locateChannel(channelName: string) {
		const channelsToDelete: GuildBasedChannel[] = []
		// Iterate over all guilds the client is in
		SapDiscClient.guilds.cache.forEach((guild) => {
			const channel = guild.channels.cache.find(
				(GC) => GC.name.toLowerCase() === channelName.toLowerCase(),
			)
			// Target Text Channels
			if (channel && channel.type !== ChannelType.GuildText) {
				return
			}
			if (channel) {
				channelsToDelete.push(channel)
			}
		})
		return channelsToDelete
	}

	/**
	 * Locate the game channel via the name and delete it
	 * @param {string} channelName - The name of the channel to locate
	 */
	async deleteChan(channelName: string) {
		const gameChans = await this.locateChannel(channelName)
		if (gameChans.length === 0) {
			return
		}
		for (const gameChan of gameChans) {
			await gameChan.delete()
		}
	}

	private async fetchVsImg(matchup: string, sport: string) {
		// Replace spaces with underscores in the matchup string
		const matchupFileName = `${matchup.replace(/\s/g, '_')}.jpg`

		// Get the directory path of the current module
		const moduleDir = path.dirname(fileURLToPath(import.meta.url))

		try {
			// Construct the path to the matchup image file
			const imagePath = path.join(
				moduleDir,
				'../../',
				'lib',
				'matchupimages',
				`${sport}`,
				matchupFileName,
			)
			// Read the image file as a binary buffer
			const img = await fs.readFile(imagePath)
			if (!img) {
				return null
			}
			return img
		} catch (error) {
			console.error(error)
			return null
		}
	}
}
