/**
 * Router for handling incoming channel creation requests.
 * @module incomingChannelsRouter
 */

import Router from 'koa-router';
import _ from 'lodash';
import ChannelManager from '../../../guilds/channels/ChannelManager.js';
import { WinstonLogger } from '../../../logging/WinstonLogger.js';
import type { ScheduledChannelsData } from './createchannels.interface.js';

const ChannelsRoutes = new Router();

/**
 * Handles POST requests to create channels based on incoming data.
 * @param {Object} ctx - Context for the incoming HTTP request.
 */
ChannelsRoutes.post('/channels/incoming', async (ctx: any) => {
	try {
		const channelManager = new ChannelManager();
		const validated = await channelManager.validateAndParseChannels(
			ctx.request.body,
		);
		if (!validated) {
			WinstonLogger.error({
				route: '/channels/incoming',
				message: 'Unable to create game channels; Invalid data received',
			});
			ctx.body = {
				message: 'Unable to create game channels; Invalid data received',
				statusCode: 500,
			};
			return;
		}
		const { channels, guilds } = ctx.request.body as ScheduledChannelsData;
		await channelManager.processChannels({
			channels,
			guilds,
		});
		ctx.body = {
			message: 'Channels created.',
			status: 200,
		};
	} catch (error) {
		console.error({
			route: '/channels/incoming',
			error: error,
		});
		ctx.body = {
			message: 'Unexpected error occurred',
			statusCode: 500,
		};
	}
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
