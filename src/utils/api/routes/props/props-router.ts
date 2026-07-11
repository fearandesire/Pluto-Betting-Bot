import Router from '@koa/router'
import { PropsController } from '../../controllers/props.controller.js'
import { validateDailyPropsPayload } from '../notifications/notification-utils.js'
import type { ReqBodyPropsEmbedsData } from './props-route.interface.js'

const PropsRouter = new Router()
const propsController = new PropsController()

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

	ctx.status = 200
	ctx.body = { message: 'Received req to process props for embed generation' }
	await propsController.processPropsForPredictionEmbeds(
		validatedPayload as unknown as ReqBodyPropsEmbedsData,
	)
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
