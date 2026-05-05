import Router from '@koa/router'
import { CacheManager } from '../../../cache/cache-manager.js'
import { logger } from '../../../logging/WinstonLogger.js'
import MatchCacheService from './match-cache-service.js'

export const matchCache = new Router()

matchCache.post('/cache/matches', async (ctx: any) => {
	try {
		if (!ctx.request?.body?.matches) {
			ctx.body = {
				success: false,
				error: 'No matches were received.',
			}
		}
		const { matches } = ctx.request.body
		await new MatchCacheService(new CacheManager()).cacheMatches(matches)
		ctx.body = {
			success: true,
		}
	} catch (error) {
		logger.error({
			message: 'Failed to cache matches.',
			source: 'matchCache:POST /cache/matches',
			error,
		})
		ctx.body = {
			success: false,
			error,
		}
	}
})
