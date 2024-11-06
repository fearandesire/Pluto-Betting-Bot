import Router from 'koa-router';
import { PropsController } from '../../controllers/props.controller.js';
import type { RequestBody } from './props-route.interface.js';
import PropsStats from '../../controllers/props-stats.js';

const PropsRouter = new Router();
const propsController = new PropsController();

PropsRouter.post('/props/daily', async (ctx) => {
	const result = await propsController.processDaily(
		ctx.request.body as RequestBody,
	);
	if (result.success) {
		ctx.status = 200;
		ctx.body = { message: result.message };
	} else {
		ctx.status = 400;
		ctx.body = { message: result.message };
	}
});

PropsRouter.post('/props/stats/post-start', async (ctx) => {
	try {
		const result = await propsController.processPostStart(
			ctx.request.body as RequestBody,
		);
		ctx.status = 200;
		ctx.body = { message: 'Success' };
		return new PropsStats().compileEmbedData(result);
	} catch (error) {
		ctx.status = 400;
		ctx.body = { message: (error as Error).message };
	}
});

export default PropsRouter;
