import Router from '@koa/router'
import { logger } from '../../../logging/WinstonLogger.js'
import { PropPostingHandler } from '../../../props/PropPostingHandler.js'
import { validateDailyPropsPayload } from '../notifications/notification-utils.js'

const PropsRouter = new Router()
const propPostingHandler = new PropPostingHandler()

const supportedSports = new Set(['nba', 'nfl'])

PropsRouter.post('/props/daily', async (ctx) => {
	const validatedPayload = validateDailyPropsPayload(ctx.request.body || {})
	if (!validatedPayload) {
		ctx.status = 422
		ctx.body = {
			success: false,
			error: 'Invalid props payload. Failed Zod validation.',
		}
		return
	}

	const unsupportedSport = validatedPayload.guilds.find(
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
		const results = await Promise.all(
			validatedPayload.guilds.map((guild) =>
				propPostingHandler.postPropsToChannel(
					guild.guild_id,
					validatedPayload.props,
					guild.sport.toLowerCase() as 'nba' | 'nfl',
					guild.channel_id,
				),
			),
		)
		const failed = results.reduce(
			(total, result) => total + result.failed,
			0,
		)
		if (failed > 0) {
			logger.error({
				method: 'PropsRouter',
				event: 'props_daily_delivery_failed',
				failed,
				results,
			})
			ctx.status = 500
			ctx.body = {
				success: false,
				error: 'Failed to deliver one or more daily props.',
				results,
			}
			return
		}

		ctx.status = 200
		ctx.body = {
			success: true,
			results,
		}
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
