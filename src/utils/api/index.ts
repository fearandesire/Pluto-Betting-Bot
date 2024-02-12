import Koa from 'koa'
import cors from '@koa/cors'
import logger from 'koa-logger'
import bodyParser from 'koa-bodyparser'
import logClr from '@pluto-internal-color-logger'
import { pageNotFound, responseTime } from './requests/middleware.js'
import incomingChannelsRouter from './routes/channels/incoming.js'
import ScheduleRouter from './routes/schedule/schedule.js'
import NotificationRouter from './routes/notifications/notifications.controller.js'
import { matchCache } from './routes/cache/match-cache.js'

const app = new Koa()
app.use(logger())
app.use(cors())
app.use(bodyParser())
app.use(pageNotFound)
app.use(responseTime)

app.use(incomingChannelsRouter.routes()).use(
	incomingChannelsRouter.allowedMethods(),
)

app.use(matchCache.routes()).use(matchCache.allowedMethods())

app.use(NotificationRouter.routes()).use(NotificationRouter.allowedMethods())

app.use(ScheduleRouter.routes()).use(ScheduleRouter.allowedMethods())

const { apiPort, apiURL } = process.env

app.listen(apiPort, async () => {
	await logClr({
		text: `API running at ${apiURL}:${apiPort}/`,
		status: `done`,
		color: `green`,
	})
})

export { app }
