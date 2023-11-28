import Koa from 'koa'
import cors from '@koa/cors'
import logger from 'koa-logger'
import bodyParser from 'koa-bodyparser'
import {
	pageNotFound,
	responseTime,
} from './requests/middleware.js'
import oddsRouter from '#routes/odds'
import checkGamesRouter from '#routes/checkGames'
import fetchBetsRouter from '#routes/fetchBets'
import logClr from '#colorConsole'
import fetchAccountsRouter from '#routes/fetchAccounts'

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

const { apiPort, apiURL } = process.env

app.listen(apiPort, async () => {
	await logClr({
		text: `API running at ${apiURL}:${apiPort}/`,
		status: `done`,
		color: `green`,
	})
})

export { app }
