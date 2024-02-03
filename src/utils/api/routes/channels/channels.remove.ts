import Router from 'koa-router'
import _ from 'lodash'
import ChannelManager from '../../../db/gameSchedule/ChannelManager'
import PlutoLogger from '@pluto-logger'

const removeChannelsRouter: Router = new Router()

/**
 * Handles POST requests to remove channels based on incoming data.
 * Expecting the incoming data to be an array of strings that are the channel names to search & remove
 * @param {Object} ctx - Context for the incoming HTTP request.
 */
removeChannelsRouter.post(`/channels/remove`, async (ctx: any) => {
	try {
		const { channelNames }: { channelNames: string[] } = ctx.request.body
		if (channelNames === null) {
			await PlutoLogger.log({
				id: `api`,
				description:
					'Unable to delete active game channels:\nNo channel names were received.',
			})
		}
		if (!_.isArray(channelNames)) {
			await PlutoLogger.log({
				id: `api`,
				description:
					'Unable to delete active game channels:\nInternal server error.',
			})
		}
		for (const channelName of channelNames) {
			const channelManager = new ChannelManager()
			await channelManager.deleteChan(channelName)
		}
		await PlutoLogger.log({
			id: `2`,
			description: `Removed completed game channels.`,
		})
	} catch (e) {
		console.log(e)
	}
})
