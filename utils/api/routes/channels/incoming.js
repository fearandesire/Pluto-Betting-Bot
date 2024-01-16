/**
 * Router for handling incoming channel creation requests.
 * @module incomingChannelsRouter
 */

import Router from 'koa-router'
import _ from 'lodash'
import teamResolver from 'resolve-team'
import { findEmoji } from '@pluto-general-utils/findEmoji.js'
import discord, { EmbedBuilder } from 'discord.js'
import axios from 'axios'
import { getCategories } from '../../utils/getCategories.js'
import { SapDiscClient } from '../../../../Pluto.mjs'
import { pluto_api_url } from '../../../serverConfig.js'

const { ChannelType } = discord
const incomingChannelsRouter = new Router()

/**
 * Handles POST requests to create channels based on incoming data.
 * @async
 * @param {Object} ctx - Koa context for the incoming HTTP request.
 */
incomingChannelsRouter.post(
	`/channels/incoming`,
	async (ctx) => {
		try {
			const channels = await validateAndParseChannels(
				ctx,
			)
			const bettingChanRows =
				await fetchBettingChannelIds()

			for (const channel of channels) {
				await processChannel(
					channel,
					bettingChanRows,
				)
			}

			ctx.body = {
				message: 'Channels created.',
				status: 200,
			}
			console.log(`Complete`)
		} catch (error) {
			ctx.status = error.status || 500
			ctx.body = { error: error.message }
			console.error(
				`Error processing channels:`,
				error,
			)
		}
	},
)

/**
 * Validates and parses incoming channel data from the request.
 * @async
 * @param {Object} ctx - Koa context containing the request body.
 * @returns {Array} Array of channel data objects.
 * @throws {Error} If no channels data is received.
 */
async function validateAndParseChannels(ctx) {
	const { channels } = ctx.request.body
	if (_.isEmpty(channels)) {
		ctx.status = 204
		throw new Error('No channels were received.')
	}
	return channels
}

/**
 * Fetches betting channel IDs from the Pluto API.
 * @async
 * @returns {Array} Array of betting channel data.
 */
async function fetchBettingChannelIds() {
	const response = await axios.get(
		`${pluto_api_url}/discord/configs/all/betting-channels`,
		{
			headers: {
				'admin-token': `${process.env.PLUTO_API_TOKEN}`,
			},
		},
	)
	return response.data
}

/**
 * Processes each channel and handles creation and embed sending.
 * @async
 * @param {Object} channel - The channel data to process.
 * @param {Array} bettingChanRows - Array of betting channel data.
 */
async function processChannel(channel, bettingChanRows) {
	const { matchupOdds } = channel
	const { favored } = matchupOdds
	const favoredTeamInfo = await teamResolver(
		channel.sport.toLowerCase(),
		favored,
		{ full: true },
	)
	validateFavoredTeamInfo(favoredTeamInfo)

	const categoriesData = await getCategories()
	if (!categoriesData)
		throw new Error(`Could not get categories.`)

	for (const category of categoriesData) {
		await createChannelAndSendEmbed(
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
function validateFavoredTeamInfo(favoredTeamInfo) {
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
async function createChannelAndSendEmbed(
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

	const matchEmbed = await prepareMatchupEmbed({
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
	console.log(`Created channel: ${channel.channelname} `)
}

async function prepareMatchupEmbed({
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

export default incomingChannelsRouter
