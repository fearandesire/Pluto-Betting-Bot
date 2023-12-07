import Router from 'koa-router'
import _ from 'lodash'
import apiVersion from '../apiVersioning.js'
import ScheduledChannelsManager from '../../bot_res/classes/ScheduledChannelsManager.js'

const fetchScheduledRouter = new Router()

fetchScheduledRouter.get(
	`/${apiVersion}/scheduled/all`,

	async (ctx) => {
		ctx.status = 102
		try {
			const scheduledChannels =
				await new ScheduledChannelsManager().getAll()

			if (
				_.isEmpty(scheduledChannels) ||
				_.isUndefined(scheduledChannels) ||
				_.isNull(scheduledChannels)
			) {
				ctx.body = {
					error: `There are no scheduled channels.`,
				}
				ctx.status = 204
				return
			}
			ctx.body = {
				scheduledChannels,
			}
			ctx.status = 200
		} catch (err) {
			ctx.body = {
				error: `Unable to retrieve scheduled channels.`,
			}
			ctx.status = 500
		}
	},
)

export default fetchScheduledRouter
