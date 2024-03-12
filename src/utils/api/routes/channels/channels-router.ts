/**
 * Router for handling incoming channel creation requests.
 * @module incomingChannelsRouter
 */

import Router from 'koa-router'
import ChannelManager from '../../../guilds/channels/ChannelManager.js'
import PlutoLogger from '@pluto-logger'
import _ from 'lodash'

const ChannelsRoutes = new Router()

/**
 * Handles POST requests to create channels based on incoming data.
 * @param {Object} ctx - Context for the incoming HTTP request.
 */
ChannelsRoutes.post(`/channels/incoming`, async (ctx: any) => {
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

/**
 * Handles DELETE requests to remove channels based on incoming data.
 * Expecting the incoming data to be an array of strings that are the channel names to search & remove
 * @param {Object} ctx - Context for the incoming HTTP request.
 */
ChannelsRoutes.delete(`/channels/delete`, async (ctx: any) => {
	try {
		const { channelNames }: { channelNames: string[] } = ctx.request.body

		if (channelNames === null) {
			await PlutoLogger.log({
				id: `api`,
				description:
					'Unable to delete active game channels:\nNo channel names were received.',
			})
			ctx.body = {
				message: 'No channel names were received.',
				statusCode: 500,
			}
			return
		}
		if (!_.isArray(channelNames)) {
			await PlutoLogger.log({
				id: `api`,
				description:
					'Unable to delete active game channels:\nInternal server error.',
			})
			ctx.body = {
				message: 'No channel names were received.',
				statusCode: 500,
			}
		}
		for (const channelName of channelNames) {
			const channelManager = new ChannelManager()
			await channelManager.deleteChan(channelName)
		}
		await PlutoLogger.log({
			id: `2`,
			description: `Removed completed game channels.`,
		})
		ctx.body = {
			message: 'Channels deleted.',
			statusCode: 200,
		}
	} catch (e) {
		console.log(e)
	}
})

export default ChannelsRoutes
