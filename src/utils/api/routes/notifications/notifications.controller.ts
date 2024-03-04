import Router from 'koa-router'
import NotificationService from './notifications.service.js'
import { SapDiscClient } from '@pluto-core'
import _ from 'lodash'
import { isNotifyBetUsers } from './notification-utils.js'

const NotificationRouter = new Router()

NotificationRouter.post(`/notifications/bets/results`, async (ctx) => {
	const NotificationData = ctx.request.body || {}

	// Check if the NotificationData is empty or if it fails validation
	if (_.isEmpty(NotificationData) || !isNotifyBetUsers(NotificationData)) {
		ctx.body = {
			success: false,
			error: 'Invalid or no notification data was received.',
		}
		return // Make sure to exit the function here
	}

	console.debug('Validated Data:', NotificationData)

	// Proceed with processing as the data is valid
	await new NotificationService(SapDiscClient).processBetResults(
		NotificationData,
	)
	// You might want to send a success response here

	ctx.body = {
		success: true,
	}
})

export default NotificationRouter
