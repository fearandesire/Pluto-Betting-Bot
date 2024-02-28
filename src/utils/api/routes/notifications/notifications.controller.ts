import Router from 'koa-router'
import { NotifyBetUsers } from '../../common/interfaces/notifications.js'
import NotificationService from './notifications.service.js'
import { SapDiscClient } from '@pluto-core'

const NotificationRouter = new Router()

NotificationRouter.post(`notifications/bets/results`, async (ctx: any) => {
	const NotificationData: NotifyBetUsers = ctx.request.body
	await new NotificationService(SapDiscClient).processBetResults(
		NotificationData,
	)
})

export default NotificationRouter
