import Router from '@koa/router'
import { logger } from '../../../logging/WinstonLogger.js'
import { validateNotifyBetUsers } from './notification-utils.js'
import NotificationService from './notifications.service.js'

const NotificationRouter = new Router()

NotificationRouter.post('/notifications/bets/results', async (ctx) => {
	const rawPayload = ctx.request.body || {}

	const validatedData = validateNotifyBetUsers(rawPayload)

	if (!validatedData) {
		logger.warn({
			method: 'NotificationRouter',
			event: 'push_payload_rejected',
			schema: 'notificationBetResults',
		})
		ctx.body = {
			success: false,
			error: 'Invalid notification data. Failed Zod validation.',
		}
		ctx.status = 422
		return
	}

	try {
		await new NotificationService().processBetResults(validatedData)
		ctx.body = {
			success: true,
		}
	} catch (error) {
		logger.error({
			method: 'NotificationRouter',
			message: 'CRITICAL: Failed to process bet result notifications',
			error: error instanceof Error ? error.message : error,
			critical: true,
		})
		ctx.body = {
			success: false,
			error: 'Failed to process notifications',
		}
		ctx.status = 500
	}
})

export default NotificationRouter
