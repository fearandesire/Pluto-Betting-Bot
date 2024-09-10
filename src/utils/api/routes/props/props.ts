import Router from 'koa-router'
import { RequestBody } from './props-route.interface.js'
import { PropsController } from '../../controllers/props.controller.js'

const PropsRouter = new Router()
const propsController = new PropsController()

PropsRouter.post('/props/daily', async (ctx) => {
	const result = await propsController.processDaily(
		ctx.request.body as RequestBody,
	)

	if (result.success) {
		ctx.status = 200
		ctx.body = { message: result.message }
	} else {
		ctx.status = 400
		ctx.body = { message: result.message }
	}
})

export default PropsRouter
