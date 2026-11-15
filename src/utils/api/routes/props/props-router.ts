import Router from '@koa/router'
import { logger } from '../../../logging/WinstonLogger.js'
import {
	deliveryEnvelopeSchema,
	deliveryReceipts,
} from '../notifications/delivery-contract.js'
import { getNotificationDeliveryQueue } from '../notifications/delivery-queue.js'
import {
	type DailyPropsPayload,
	dailyPropsPayloadSchema,
} from '../shared-payload-schemas.js'

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

	const boardIssue = validateBoards(parsedPayload.data)
	if (boardIssue) {
		logger.warn({
			method: 'PropsRouter',
			event: 'push_payload_rejected',
			schema: 'dailyPropsPayload.boards',
			issues: [{ path: ['boards'], message: boardIssue }],
		})
		ctx.status = 422
		ctx.body = {
			success: false,
			error: `Invalid props payload. ${boardIssue}`,
			issues: [{ path: ['boards'], message: boardIssue }],
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

/**
 * A board list must cover every pair exactly once and keep each entry on its
 * own game. Khronos groups the payload, but a producer bug must fail here
 * rather than post a partial board or a receipt the ledger cannot match.
 */
function validateBoards(payload: DailyPropsPayload): string | null {
	const boards = payload.boards
	if (!boards || boards.length === 0) return null
	const byOver = new Map(
		payload.props.map((prop) => [prop.over.outcome_uuid, prop]),
	)
	const seen = new Set<string>()
	for (const [index, board] of boards.entries()) {
		for (const outcomeUuid of board.over_outcome_uuids) {
			const prop = byOver.get(outcomeUuid)
			if (!prop) {
				return `Board ${index} names an outcome that is not in props.`
			}
			if (prop.event_id !== board.event_id) {
				return `Board ${index} mixes outcomes from another game.`
			}
			if (seen.has(outcomeUuid)) {
				return `Board ${index} repeats an outcome from another board.`
			}
			seen.add(outcomeUuid)
		}
	}
	if (seen.size !== payload.props.length) {
		return 'Every prop must belong to exactly one board.'
	}
	return null
}
