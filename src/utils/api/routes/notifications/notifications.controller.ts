import Router from '@koa/router'
import type { Context, Next } from 'koa'
import { z } from 'zod'
import { logger } from '../../../logging/WinstonLogger.js'
import { deliveryEnvelopeSchema } from './delivery-contract.js'
import { getNotificationDeliveryQueue } from './delivery-queue.js'
import { validateNotifyBetUsers } from './notification-utils.js'
import NotificationService from './notifications.service.js'
import { validateParlayResultNotification } from './parlay-notification-utils.js'
import { validatePropSettledNotification } from './prop-settled-notification-utils.js'

const NotificationRouter = new Router()

/**
 * The app-level API-key middleware normally runs before this router. Keep a
 * route-local guard as defense in depth so mounting the router elsewhere
 * cannot expose a caller-controlled Discord message edit endpoint.
 */
async function requireApiKeyAuthentication(ctx: Context, next: Next) {
	if (ctx.state.apiKeyAuthenticated !== true) {
		ctx.status = 401
		ctx.body = {
			status: 'error',
			code: 'UNAUTHENTICATED_NOTIFICATION_CALLBACK',
			message: 'Authenticated service credentials are required',
		}
		return
	}
	await next()
}

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

NotificationRouter.post('/notifications/parlays/results', async (ctx) => {
	const rawPayload = ctx.request.body || {}
	const envelope = deliveryEnvelopeSchema.safeParse(rawPayload)
	if (envelope.success && envelope.data.kind === 'parlay_result') {
		try {
			const record = await getNotificationDeliveryQueue().accept(
				envelope.data,
			)
			ctx.status = 202
			ctx.body = {
				delivery_id: record.delivery_id,
				status: record.state,
			}
			return
		} catch (error) {
			if (
				error instanceof Error &&
				(error as Error & { code?: string }).code ===
					'DELIVERY_PAYLOAD_MISMATCH'
			) {
				ctx.status = 409
				ctx.body = {
					success: false,
					code: 'DELIVERY_PAYLOAD_MISMATCH',
					error: 'delivery_id is already used for another payload',
				}
				return
			}
			logger.error({
				method: 'NotificationRouter',
				event: 'parlay.notification.queue_failed',
				error: error instanceof Error ? error.message : String(error),
			})
			ctx.status = 503
			ctx.body = {
				success: false,
				error: 'Notification queue unavailable',
			}
			return
		}
	}
	if ('delivery_id' in (rawPayload as object)) {
		ctx.status = 422
		ctx.body = {
			success: false,
			error: 'Invalid delivery envelope. Failed Zod validation.',
		}
		return
	}
	const validatedData = validateParlayResultNotification(rawPayload)

	if (!validatedData) {
		ctx.body = {
			success: false,
			error: 'Invalid parlay notification data. Failed Zod validation.',
		}
		ctx.status = 422
		return
	}

	try {
		await new NotificationService().processParlayResult(validatedData)
		ctx.body = {
			success: true,
		}
	} catch (error) {
		logger.error({
			method: 'NotificationRouter',
			event: 'parlay.notification.processing_failed',
			message: 'CRITICAL: Failed to process parlay result notification',
			error: error instanceof Error ? error.message : error,
			critical: true,
			parlay_id: validatedData.parlay_id,
			user_id: validatedData.user_id,
			kind: validatedData.kind,
		})
		ctx.body = {
			success: false,
			error: 'Failed to process parlay notifications',
		}
		ctx.status = 500
	}
})

NotificationRouter.post(
	'/notifications/props/settled',
	requireApiKeyAuthentication,
	async (ctx) => {
		const rawPayload = ctx.request.body || {}
		const envelope = deliveryEnvelopeSchema.safeParse(rawPayload)
		if (envelope.success && envelope.data.kind === 'prop_settled') {
			try {
				const record = await getNotificationDeliveryQueue().accept(
					envelope.data,
				)
				ctx.status = 202
				ctx.body = {
					delivery_id: record.delivery_id,
					status: record.state,
				}
				return
			} catch (error) {
				if (
					error instanceof Error &&
					(error as Error & { code?: string }).code ===
						'DELIVERY_PAYLOAD_MISMATCH'
				) {
					ctx.status = 409
					ctx.body = {
						success: false,
						code: 'DELIVERY_PAYLOAD_MISMATCH',
						error: 'delivery_id is already used for another payload',
					}
					return
				}
				logger.error({
					method: 'NotificationRouter',
					event: 'prop.notification.queue_failed',
					error:
						error instanceof Error ? error.message : String(error),
				})
				ctx.status = 503
				ctx.body = {
					success: false,
					error: 'Notification queue unavailable',
				}
				return
			}
		}
		if ('delivery_id' in (rawPayload as object)) {
			ctx.status = 422
			ctx.body = {
				success: false,
				error: 'Invalid delivery envelope. Failed Zod validation.',
			}
			return
		}
		const validatedData = validatePropSettledNotification(rawPayload)

		if (!validatedData) {
			ctx.body = {
				success: false,
				error: 'Invalid prop settlement notification data. Failed Zod validation.',
			}
			ctx.status = 422
			return
		}

		try {
			await new NotificationService().processPropSettled(validatedData)
			ctx.body = {
				success: true,
			}
		} catch (error) {
			logger.error({
				method: 'NotificationRouter',
				event: 'prop.notification.processing_failed',
				message:
					'CRITICAL: Failed to process prop settlement notification',
				error: error instanceof Error ? error.message : error,
				critical: true,
				outcome_uuid: validatedData.outcome_uuid,
			})
			ctx.body = {
				success: false,
				error: 'Failed to process prop settlement notification',
			}
			ctx.status = 500
		}
	},
)

NotificationRouter.get(
	'/deliveries/:delivery_id',
	requireApiKeyAuthentication,
	async (ctx) => {
		const deliveryId = ctx.params.delivery_id
		if (!z.string().uuid().safeParse(deliveryId).success) {
			ctx.status = 422
			ctx.body = { success: false, error: 'delivery_id is required' }
			return
		}
		const record = await getNotificationDeliveryQueue().get(deliveryId)
		if (!record) {
			ctx.status = 404
			ctx.body = { success: false, error: 'Delivery not found' }
			return
		}
		ctx.status = 200
		ctx.body = {
			delivery_id: record.delivery_id,
			status: record.state,
			attempts: record.attempts,
			destinations: record.destinations,
			delivered_at: record.delivered_at,
		}
	},
)

export default NotificationRouter
