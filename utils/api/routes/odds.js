import Router from 'koa-router'
import apiVersion from '../apiVersioning.js'
import { MatchupManager } from '#MatchupManager'
import { allOddsRL } from '../requests/ratelimits.js'

const oddsRouter = new Router()

oddsRouter.get(`/${apiVersion}/odds/all`, async (ctx) => {
	try {
		if (allOddsRL.limited) {
			ctx.body = {
				error: `Rate limit exceeded.`,
			}
			ctx.status = 429
			return
		}
		const allMatchups =
			await MatchupManager.getAllMatchups()

		ctx.body = {
			matches: allMatchups,
		}
		ctx.status = 200
		allOddsRL.consume()
		return
	} catch (err) {
		ctx.body = {
			error: `Unable to retrieve odds.`,
		}
		ctx.status = 500
		
	}
})

export default oddsRouter
