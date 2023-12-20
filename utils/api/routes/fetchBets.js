import Router from 'koa-router'
import {
	BETSLIPS,
	PROFILES,
	LIVEBETS,
} from '@pluto-server-config'
import apiVersion from '../apiVersioning.js'
import BetManager from '../../bot_res/classes/BetManager.js'

const fetchBetsRouter = new Router()

fetchBetsRouter.get(
	`/${apiVersion}/bets/current`,
	async (ctx) => {
		try {
			const betManager = new BetManager({
				BETSLIPS,
				PROFILES,
				LIVEBETS,
			})
			const currentBets =
				await betManager.currentBets()
			await console.log(`All Bets:\n`, currentBets)
			ctx.body = {
				bets: currentBets,
			}
			ctx.status = 200
		} catch (err) {
			ctx.body = {
				error: `Unable to retrieve current bets.`,
			}
			ctx.status = 500
		}
	},
)

export default fetchBetsRouter
