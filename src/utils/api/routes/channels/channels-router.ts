/**
 * Router for handling incoming channel creation requests.
 * @module incomingChannelsRouter
 */

import Router from '@koa/router'
import _ from 'lodash'
import type { IncomingChannelData } from '../../../cache/data/schemas.js'
import ChannelManager from '../../../guilds/channels/ChannelManager.js'
import { canonicalGameId } from '../../../logging/game-channel-stage.js'
import { logger } from '../../../logging/WinstonLogger.js'

const ChannelsRoutes = new Router()

/**
 * Handles POST requests to create channels based on incoming data.
 * @param {Object} ctx - Context for the incoming HTTP request.
 */
ChannelsRoutes.post('/channels/create', async (ctx: any) => {
	const channelManager = new ChannelManager()
	const body = ctx.request.body
	const incoming: unknown[] = Array.isArray(body?.channels)
		? body.channels
		: []
	logger.info('Received request to create channels', {
		channelCount: incoming.length,
		guildCount: Array.isArray(body?.guilds) ? body.guilds.length : 0,
		gameIds: incoming
			.slice(0, 50)
			.map((channel) =>
				canonicalGameId((channel as { id?: unknown })?.id),
			),
	})
	await channelManager.validateAndParseChannels(ctx.request.body)
	const { channels, guilds } = ctx.request.body as IncomingChannelData
	try {
		await channelManager.processChannels({
			channels,
			guilds,
		})
	} catch (err) {
		logger.error('Error creating channels', {
			error: err,
		})
		throw err
	}
	ctx.body = {
		message: 'Channels created.',
		status: 200,
	}
})

/**
 * Handles DELETE requests to remove channels based on incoming data.
 * Expecting the incoming data to be an array of strings that are the channel names to search & remove
 * @param {Object} ctx - Context for the incoming HTTP request.
 */
ChannelsRoutes.delete('/channels/delete', async (ctx: any) => {
	try {
		const { channelNames }: { channelNames: string[] } = ctx.request.body

		if (channelNames === null) {
			logger.warn('No channel names were received.', {
				route: '/channels/delete',
			})
			ctx.body = {
				message: 'No channel names were received.',
				statusCode: 500,
			}
			return
		}
		if (!_.isArray(channelNames)) {
			logger.warn(
				'Unable to process channels to delete; Invalid data received.',
				{ route: '/channels/delete' },
			)
			ctx.body = {
				message:
					'Unable to process channels to delete; Invalid data received.',
				statusCode: 500,
			}
			return
		}
		for (const channelName of channelNames) {
			const channelManager = new ChannelManager()
			await channelManager.deleteChan(channelName)
		}
		logger.info('Completed channel deletion.', {
			route: '/channels/delete',
			channelCount: channelNames.length,
		})
		ctx.body = {
			message: 'Channels deleted.',
			statusCode: 200,
		}
	} catch (e) {
		logger.error('Channel deletion failed', {
			route: '/channels/delete',
			error: e instanceof Error ? e.message : String(e),
		})
	}
})

export default ChannelsRoutes
