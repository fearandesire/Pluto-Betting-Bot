import Router from '@koa/router'
import { z } from 'zod'
import {
	discordSnowflakeSchema,
	guildModeratorLookupResponseSchema,
} from '../moderation-payload-schemas.js'
import { GuildModeratorLookupService } from './moderation-service.js'

const querySchema = z.object({
	user_id: discordSnowflakeSchema,
})

interface ModeratorLookup {
	lookup(userId: string): Promise<unknown>
}

export function createModerationRouter(
	service: ModeratorLookup = new GuildModeratorLookupService(),
): Router {
	const router = new Router()

	router.get('/internal/moderation/guilds', async (ctx) => {
		const query = querySchema.safeParse(ctx.query)
		if (!query.success) {
			ctx.status = 400
			ctx.body = { error: 'invalid_user_id' }
			return
		}

		try {
			ctx.body = guildModeratorLookupResponseSchema.parse(
				await service.lookup(query.data.user_id),
			)
			ctx.status = 200
		} catch {
			ctx.status = 503
			ctx.body = { error: 'moderation_lookup_unavailable' }
		}
	})

	return router
}

export default createModerationRouter()
