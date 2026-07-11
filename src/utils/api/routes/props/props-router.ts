import Router from '@koa/router'
import { logger } from '../../../logging/WinstonLogger.js'
import { PropPostingHandler } from '../../../props/PropPostingHandler.js'
import { dailyPropsPayloadSchema } from '../shared-payload-schemas.js'

const PropsRouter = new Router()
const propPostingHandler = new PropPostingHandler()

const supportedSports = new Set(['nba', 'nfl'])

PropsRouter.post('/props/daily', async (ctx) => {
	const parsedPayload = dailyPropsPayloadSchema.safeParse(
		ctx.request.body ?? {},
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
			error: 'Invalid props payload. Failed Zod validation.',
			issues: parsedPayload.error.issues,
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
		const postingResults = await Promise.all(
			parsedPayload.data.guilds.map((guild) =>
				propPostingHandler.postPropsToChannel(
					guild.guild_id,
					parsedPayload.data.props,
					guild.sport.toLowerCase() as 'nba' | 'nfl',
					guild.channel_id,
				),
			),
		)
		const references = postingResults.flatMap((result) => result.results)
		const failures = postingResults.flatMap((result) => result.failures)

		if (failures.length > 0) {
			logger.warn({
				method: 'PropsRouter',
				event: 'props_daily_partial_delivery',
				posted_count: references.length,
				failed_count: failures.length,
				failures,
			})
			ctx.set('X-Props-Failed', String(failures.length))

			if (references.length === 0) {
				ctx.status = 500
				ctx.body = {
					success: false,
					error: 'Failed to deliver daily props.',
					posted: references,
					failures,
				}
				return
			}

			// 207 keeps successful message refs parseable by Khronos while
			// exposing retryable failures through the status/header and logs.
			ctx.status = 207
			ctx.body = references
			return
		}

		ctx.status = 200
		ctx.body = references
	} catch (error) {
		logger.error({
			method: 'PropsRouter',
			event: 'props_daily_processing_failed',
			error: error instanceof Error ? error.message : String(error),
		})
		ctx.status = 500
		ctx.body = {
			success: false,
			error: 'Failed to process daily props.',
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
