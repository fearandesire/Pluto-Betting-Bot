/**
 * @module ApiIndex
 * @description This module is the main entry & setup point for the Pluto API. This REST API is used for receiving data to trigger interactions with the application
 *
 */

import cors from '@koa/cors';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import logger from 'koa-logger';
import logClr from '../bot_res/ColorConsole.js';
import { pageNotFound, responseTime } from './requests/middleware.js';
import { matchCache } from './routes/cache/match-cache.js';
import ChannelsRoutes from './routes/channels/channels-router.js';
import NotificationRouter from './routes/notifications/notifications.controller.js';
import PropsRouter from './routes/props/props-router.js';
import ScheduleRouter from './routes/schedule/schedule.js';

const app = new Koa();
app.use(logger());
app.use(cors());
app.use(bodyParser());
app.use(pageNotFound);
app.use(responseTime);

app.use(ChannelsRoutes.routes()).use(ChannelsRoutes.allowedMethods());
app.use(NotificationRouter.routes()).use(NotificationRouter.allowedMethods());
app.use(matchCache.routes()).use(matchCache.allowedMethods());
app.use(ScheduleRouter.routes()).use(ScheduleRouter.allowedMethods());
app.use(PropsRouter.routes()).use(PropsRouter.allowedMethods());
const { apiPort, apiURL } = process.env;

app.listen(apiPort, async () => {
	logClr({
		text: `API running at ${apiURL}:${apiPort}/`,
		status: 'done',
		color: 'green',
	});
});

export { app };
