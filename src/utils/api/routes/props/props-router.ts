import Router from 'koa-router';
import { PropsController } from '../../controllers/props.controller.js';
import type { ReqBodyPropsEmbedsData } from './props-route.interface.js';

const PropsRouter = new Router();
const propsController = new PropsController();

PropsRouter.post('/props/daily', async (ctx) => {
	ctx.status = 200;
	ctx.body = { message: 'Received req to process props for embed generation' };
	await propsController.processPropsForPredictionEmbeds(
		ctx.request.body as ReqBodyPropsEmbedsData,
	);
});

PropsRouter.post('/props/stats/post-start', async (ctx) => {
	// ? Disabled for now
	ctx.status = 200;
	ctx.body = {
		message:
			'Received request to process Props post-start stats (Disabled Feature)',
	};
	return;
	/* 	try {
		WinstonLogger.info({
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
});

export default PropsRouter;
