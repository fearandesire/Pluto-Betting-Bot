import Router from 'koa-router'
import NotificationService from './notifications.service.js'
import { SapDiscClient } from '@pluto-core'
import _ from 'lodash'
import { isNotifyBetUsers } from './notification-utils.js'

const NotificationRouter = new Router()

NotificationRouter.post(`/notifications/bets/results`, async (ctx) => {
	const NotificationData = ctx.request.body || {}
	console.debug({
		method: `NotificationRouter`,
		message: 'Notification data received.',
		data: NotificationData,
	})
	// Check if the NotificationData is empty or if it fails validation
	if (_.isEmpty(NotificationData) || !isNotifyBetUsers(NotificationData)) {
		console.debug({
			method: `NotificationRouter`,
			message: 'Invalid or no notification data was received.',
			data: NotificationData,
		})
		ctx.body = {
			success: false,
			error: 'Invalid or no notification data was received.',
		}
		return // Make sure to exit the function here
	}
	// Proceed with processing as the data is valid
	await new NotificationService().processBetResults(
		NotificationData,
		SapDiscClient,
	)
	ctx.body = {
		success: true,
	}
})

export default NotificationRouter
