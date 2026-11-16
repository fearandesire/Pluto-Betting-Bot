import Router from '@koa/router'
import { z } from 'zod'
import { logger } from '../../../logging/WinstonLogger.js'
import {
	explicitChannelResolver,
	RecapPostService,
} from '../../../recap/recap-post-service.js'
import RecapWrapper from '../../Khronos/recap/recap-wrapper.js'

const RecapRouter = new Router()

const snowflake = z.string().regex(/^\d{17,20}$/)

export const postRecapSchema = z.object({
	guild_id: snowflake,
	channel_id: snowflake,
	type: z.enum(['weekly', 'monthly']),
	sport: z.enum(['nfl', 'nba']).default('nfl'),
})

/**
 * Khronos-to-Pluto trigger for a staff "post now" action. The shared API key
 * middleware sets `apiKeyAuthenticated`; the route re-checks it so it never
 * depends on how it is mounted.
 */
RecapRouter.post('/recap/post', async (ctx) => {
	if (ctx.state.apiKeyAuthenticated !== true) {
		ctx.status = 401
		ctx.body = { success: false, error: 'Unauthorized' }
		return
	}

	const parsed = postRecapSchema.safeParse(ctx.request.body ?? {})
	if (!parsed.success) {
		ctx.status = 422
		ctx.body = {
			success: false,
			error: 'Invalid recap post payload',
			issues: parsed.error.issues,
		}
		return
	}

	try {
		const result = await new RecapPostService(
			new RecapWrapper(),
			explicitChannelResolver,
		).post({
			guildId: parsed.data.guild_id,
			channelId: parsed.data.channel_id,
			type: parsed.data.type,
			sport: parsed.data.sport,
		})
		ctx.status = 200
		ctx.body = {
			success: true,
			channel_id: result.channel_id,
			message_id: result.message_id,
		}
	} catch (error) {
		logger.error({
			message: 'recap_post_failed',
			metadata: {
				guild_id: parsed.data.guild_id,
				channel_id: parsed.data.channel_id,
				type: parsed.data.type,
				sport: parsed.data.sport,
				error: error instanceof Error ? error.message : String(error),
			},
		})
		ctx.status = 502
		ctx.body = {
			success: false,
			error: 'Could not post the recap',
		}
	}
})

export default RecapRouter
