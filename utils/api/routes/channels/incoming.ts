/**
 * Router for handling incoming channel creation requests.
 * @module incomingChannelsRouter
 */

import Router from 'koa-router'
import _ from 'lodash'
import axios from 'axios'
import resolveTeam from 'resolve-team'
import { pluto_api_url } from '../../../serverConfig.js'
import ChannelManager from '../../../db/gameSchedule/ChannelManager.js'
import KhronosManager from '../../requests/KhronosManager.js'
import { IChannelAggregatedAPI } from './createchannels.interface.js'
import { IConfigRow } from 'lib/interfaces/api/ApiInterfaces.js'

const incomingChannelsRouter = new Router()

/**
 * Handles POST requests to create channels based on incoming data.
 * @async
 * @param {Object} ctx - Koa context for the incoming HTTP request.
 */
incomingChannelsRouter.post(`/channels/incoming`, async (ctx: any) => {
	try {
		const channels = await validateAndParseChannels(ctx.request.body)
		const bettingChanRows = await fetchBettingChannelIds()

		for (const channel of channels) {
			await processChannel(channel, bettingChanRows)
		}

		ctx.body = {
			message: 'Channels created.',
			status: 200,
		}
		console.log(`Complete`)
	} catch (error) {
		ctx.body = error
	}
})

/**
 * Processes each channel and handles creation and embed sending.
 * @async
 * @param {Object} channel - The channel data to process.
 * @param {Array} betChanRows - Array of betting channel data.
 * @
 */
async function processChannel(
	channel: IChannelAggregatedAPI,
	betChanRows: IConfigRow[],
) {
	const { sport } = channel // Use this sport information for processing
	const { matchupOdds } = channel
	const { favored } = matchupOdds
	const favoredTeamInfo = await resolveTeam(sport.toLowerCase(), favored, {
		full: true,
	})
	validateFavoredTeamInfo(favoredTeamInfo)
	const khronosManager = new KhronosManager()
	const gameCategories =
		await khronosManager.fetchGameCategoriesBySport(sport)
	if (!gameCategories) throw new Error(`Could not get categories.`)

	// Fetch via sport
	/**
	 * @const {Object} category
	 *	guild_id
	 *	setting_value
	 *	setting_name
		sport
	 */
	for (const gameCatRow of gameCategories) {
		await new ChannelManager(gameCatRow.guild_id).createChannelAndSendEmbed(
			channel,
			gameCatRow,
			betChanRows,
			favoredTeamInfo,
		)
	}
}

/**
 * Validates and parses incoming channel data from the request.
 * @async
 * @param {Object} ctx - Koa context containing the request body.
 * @returns {Array} Array of channel data objects.
 * @throws {Error} If no channels data is received.
 */
async function validateAndParseChannels(body: any) {
	if (_.isEmpty(body)) {
		throw new Error('No channels were received.')
	}
	return body
}

/**
 * Validates the resolved team information.
 * @param {Object} favoredTeamInfo - The resolved team data.
 * @throws {Error} If team colors or data are unavailable.
 */
function validateFavoredTeamInfo(favoredTeamInfo: any) {
	if (!favoredTeamInfo || _.isEmpty(favoredTeamInfo.colors)) {
		throw new Error('Unable to resolve team colors or data')
	}
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

export default incomingChannelsRouter