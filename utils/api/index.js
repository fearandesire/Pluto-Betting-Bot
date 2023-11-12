import Koa from 'koa'
import cors from '@koa/cors'
import logger from 'koa-logger'
import bodyParser from 'koa-bodyparser'
import {
	pageNotFound,
	responseTime,
} from './requests/middleware.js'
import oddsRouter from '#routes/odds'

const app = new Koa()
app.use(logger())
app.use(cors())
app.use(bodyParser())
app.use(pageNotFound)
app.use(responseTime)
app.use(oddsRouter.routes()).use(
	oddsRouter.allowedMethods(),
)

export { app }
