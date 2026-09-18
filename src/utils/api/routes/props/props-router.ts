import Router from '@koa/router'
import { logger } from '../../../logging/WinstonLogger.js'
import {
	deliveryEnvelopeSchema,
	deliveryReceipts,
} from '../notifications/delivery-contract.js'
import { getNotificationDeliveryQueue } from '../notifications/delivery-queue.js'
import { dailyPropsPayloadSchema } from '../shared-payload-schemas.js'

const PropsRouter = new Router()

const supportedSports = new Set(['nba', 'nfl'])

PropsRouter.post('/props/daily', async (ctx) => {
	const envelope = deliveryEnvelopeSchema.safeParse(ctx.request.body ?? {})
	if (!envelope.success || envelope.data.kind !== 'prop_post') {
		logger.warn({
			method: 'PropsRouter',
			event: 'push_payload_rejected',
			schema: 'deliveryEnvelope.prop_post',
			issues: envelope.success
				? [{ message: 'Expected prop_post delivery envelope' }]
				: envelope.error.issues,
		})
		ctx.status = 422
		ctx.body = {
			success: false,
			error: 'Invalid prop-post delivery envelope. Failed Zod validation.',
			issues: envelope.success
				? [{ message: 'Expected prop_post delivery envelope' }]
				: envelope.error.issues,
		}
		return
	}

	const parsedPayload = dailyPropsPayloadSchema.safeParse(
		envelope.data.payload,
	)

	if (!parsedPayload.success) {
		logger.warn({
			method: 'PropsRouter',
			event: 'push_payload_rejected',
			schema: 'dailyPropsPayload',
			issues: parsedPayload.error.issues,
		})
		ctx.status = 422
		ctx.body = {
			success: false,
			error: 'Invalid prop-post delivery envelope. Failed Zod validation.',
			issues: parsedPayload.error.issues,
		}
		return
	}
	if (
		parsedPayload.data.props.length === 0 ||
		parsedPayload.data.guilds.length === 0
	) {
		ctx.status = 422
		ctx.body = {
			success: false,
			error: 'Prop-post delivery must include at least one prop and guild.',
		}
		return
	}

	const unsupportedSport = parsedPayload.data.guilds.find(
		(guild) => !supportedSports.has(guild.sport.toLowerCase()),
	)
	if (unsupportedSport) {
		logger.warn({
			method: 'PropsRouter',
			event: 'push_payload_rejected',
			schema: 'dailyPropsPayload',
			issues: [
				{
					path: ['guilds', 'sport'],
					message: `Unsupported sport: ${unsupportedSport.sport}`,
				},
			],
		})
		ctx.status = 422
		ctx.body = {
			success: false,
			error: 'Invalid props payload. Unsupported sport.',
		}
		return
	}

	try {
		const { record, duplicate } =
			await getNotificationDeliveryQueue().acceptDetailed(envelope.data)
		ctx.status = 202
		ctx.body = {
			accepted: true,
			duplicate,
			delivery_id: record.delivery_id,
			kind: record.kind,
			status: record.state,
			...(record.kind === 'prop_post'
				? { receipts: deliveryReceipts(record) }
				: {}),
		}
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
			method: 'PropsRouter',
			event: 'props_daily_queue_failed',
			error: error instanceof Error ? error.message : String(error),
		})
		ctx.status = 503
		ctx.body = {
			success: false,
			error: 'Prop-post delivery queue unavailable.',
		}
	}
})

PropsRouter.post('/props/stats/post-start', async (ctx) => {
	// ? Disabled for now
	ctx.status = 200
	ctx.body = {
		message:
			'Received request to process Props post-start stats (Disabled Feature)',
	}
	return
	/* 	try {
		logger.info({
			message: 'Received request to process Props post-start stats',
		});
		const result = await propsController.processPostStart(
			ctx.request.body as ReqBodyPropsEmbedsData,
		);
		ctx.status = 200;
		ctx.body = { message: 'Success' };
		return new PropsStats().compileEmbedData(result);
	} catch (error) {
		ctx.status = 400;
		ctx.body = { message: (error as Error).message };
	} */
})

export default PropsRouter
