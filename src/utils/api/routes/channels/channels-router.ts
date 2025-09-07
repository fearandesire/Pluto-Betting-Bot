/**
 * Router for handling incoming channel creation requests.
 * @module incomingChannelsRouter
 */

import Router from 'koa-router';
import _ from 'lodash';
import type { IncomingChannelData } from '../../../cache/data/schemas.js';
import ChannelManager from '../../../guilds/channels/ChannelManager.js';
import { logger } from '../../../logging/WinstonLogger.js';

const ChannelsRoutes = new Router();

/**
 * Handles POST requests to create channels based on incoming data.
 * @param {Object} ctx - Context for the incoming HTTP request.
 */
ChannelsRoutes.post('/channels/create', async (ctx: any) => {
	const channelManager = new ChannelManager();
	logger.info('Received request to create channels', {
		body: ctx.request.body,
	});
	await channelManager.validateAndParseChannels(ctx.request.body);
	const { channels, guilds } = ctx.request.body as IncomingChannelData;
	try {
		await channelManager.processChannels({
			channels,
			guilds,
		});
	} catch (err) {
		logger.error('Error creating channels', {
			error: err,
		});
		throw err;
	}
	ctx.body = {
		message: 'Channels created.',
		status: 200,
	};
});

/**
 * Handles DELETE requests to remove channels based on incoming data.
 * Expecting the incoming data to be an array of strings that are the channel names to search & remove
 * @param {Object} ctx - Context for the incoming HTTP request.
 */
ChannelsRoutes.delete('/channels/delete', async (ctx: any) => {
	try {
		const { channelNames }: { channelNames: string[] } = ctx.request.body;

		if (channelNames === null) {
			console.error({
				route: '/channels/delete',
				message: 'No channel names were received.',
			});
			ctx.body = {
				message: 'No channel names were received.',
				statusCode: 500,
			};
			return;
		}
		if (!_.isArray(channelNames)) {
			console.error({
				route: '/channels/delete',
				message: 'Unable to process channels to delete; Invalid data received.',
			});
			ctx.body = {
				message: 'Unable to process channels to delete; Invalid data received.',
				statusCode: 500,
			};
			return;
		}
		for (const channelName of channelNames) {
			const channelManager = new ChannelManager();
			await channelManager.deleteChan(channelName);
		}
		console.log({
			route: '/channels/delete',
			message: 'Completed channel deletion.',
		});
		ctx.body = {
			message: 'Channels deleted.',
			statusCode: 200,
		};
	} catch (e) {
		console.log(e);
	}
});

export default ChannelsRoutes;
