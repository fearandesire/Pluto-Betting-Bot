import Router from 'koa-router'
import apiVersion from '../apiVersioning.js'
import { handleBetMatchups } from '../../bot_res/betOps/handleBetMatchups.js'

const checkGamesRouter = new Router()

checkGamesRouter.get(
	`/${apiVersion}/checkgames`,
	async (ctx) => {
		try {
			await handleBetMatchups()
			ctx.status = 200
			ctx.body = {
				message: `Successfully checked game status`,
			}
		} catch (err) {
			ctx.status = 500
			ctx.body = {
				error: `Unable to check game status.`,
			}
		}
	},
)

export default checkGamesRouter
