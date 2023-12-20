import Koa from 'koa'
import cors from '@koa/cors'
import logger from 'koa-logger'
import bodyParser from 'koa-bodyparser'
import logClr from '@pluto-internal-color-logger'
import oddsRouter from '@pluto-iso-manager/odds.js'
import checkGamesRouter from '@pluto-iso-manager/checkGames.js'
import fetchBetsRouter from '@pluto-iso-manager/fetchBets.js'
import fetchAccountsRouter from '@pluto-iso-manager/fetchAccounts.js'
import fetchScheduledRouter from '@pluto-iso-manager/fetchScheduledChannels.js'
import {
	pageNotFound,
	responseTime,
} from './requests/middleware.js'

const app = new Koa()
app.use(logger())
app.use(cors())
app.use(bodyParser())
app.use(pageNotFound)
app.use(responseTime)
app.use(oddsRouter.routes()).use(
	oddsRouter.allowedMethods(),
)
app.use(checkGamesRouter.routes()).use(
	checkGamesRouter.allowedMethods(),
)
app.use(fetchBetsRouter.routes()).use(
	fetchBetsRouter.allowedMethods(),
)
app.use(fetchAccountsRouter.routes()).use(
	fetchAccountsRouter.allowedMethods(),
)
app.use(fetchScheduledRouter.routes()).use(
	fetchScheduledRouter.allowedMethods(),
)

const { apiPort, apiURL } = process.env

app.listen(apiPort, async () => {
	await logClr({
		text: `API running at ${apiURL}:${apiPort}/`,
		status: `done`,
		color: `green`,
	})
})

export { app }
