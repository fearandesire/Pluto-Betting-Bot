/**
 * Router for handling incoming channel creation requests.
 * @module incomingChannelsRouter
 */

import Router from 'koa-router'
import ChannelManager from '../../../guilds/channels/ChannelManager.js'
import PlutoLogger from '@pluto-logger'

const incomingChannelsRouter = new Router()

/**
 * Handles POST requests to create channels based on incoming data.
 * @param {Object} ctx - Context for the incoming HTTP request.
 */
incomingChannelsRouter.post(`/channels/incoming`, async (ctx: any) => {
	try {
		const channelManager = new ChannelManager()
		const validated = await channelManager.validateAndParseChannels(
			ctx.request.body,
		)
		if (!validated) {
			await PlutoLogger.log({
				id: `api`,
				description: `Unable to create game channels:\nNo channels were received.`,
			})
		}
		const { channels, bettingChannelRows, categoriesBySport } =
			ctx.request.body
		for (const channel of channels) {
			await channelManager.processChannel(
				channel,
				bettingChannelRows,
				categoriesBySport,
			)
		}
		ctx.body = {
			message: 'Channels created.',
			status: 200,
		}
	} catch (error) {
		console.log(error)
		await PlutoLogger.log({
			id: `api`,
			description: `Unable to create game channels:\nUnexpected Error`,
		})
		ctx.body = {
			message: `Unexpected error occurred`,
			statusCode: 500,
		}
	}
})

export default incomingChannelsRouter
