import Router from 'koa-router'
import { PROFILES } from '@pluto-server-config'
import apiVersion from '../apiVersioning.js'
import AccountManager from '../../bot_res/classes/AccountManager.js'

const fetchAccountsRouter = new Router()

fetchAccountsRouter.get(
	`/${apiVersion}/accounts/all`,
	async (ctx) => {
		try {
			const accounts = await new AccountManager(
				PROFILES,
			).getAll()
			ctx.body = {
				accounts,
			}
			ctx.status = 200
		} catch (err) {
			ctx.body = {
				error: `Unable to retrieve accounts.`,
			}
			ctx.status = 500
		}
	},
)

export default fetchAccountsRouter
