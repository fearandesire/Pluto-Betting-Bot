import { Command } from '@sapphire/framework'
import { transferbalance } from '../utils/cmd_res/transfer.js'

export class transfer extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'transfer',
			aliases: ['transfer'],
			description: 'transfer amount',
			requiredUserPermissions: ['KICK_MEMBERS'],
		})
	}
	async messageRun(message, args) {
		const targetUser = await args.pick('string').catch(() => null)
		const balance = await args.pick('string').catch(() => null)
		transferbalance(message, targetUser, balance)
	}
}
