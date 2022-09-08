import { transferbalance } from '#cmdUtil/transfer'
import { QuickError } from '#config'
import { Command } from '@sapphire/framework'

export class transfer extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'transfer',
			aliases: ['transfer', 'give'],
			description: 'Give credits to a specified user',
			requiredUserPermissions: ['KICK_MEMBERS'],
		})
	}
	async messageRun(message, args) {
		let targetUser = await args.pick('string').catch(() => null)
		let balance = await args.pick('string').catch(() => null)
		if (!targetUser || !balance) {
			QuickError(message, 'Please provide a valid user and balance')
			return
		}
		if (balance.includes(`.`)) {
			QuickError(message, 'Please provide a whole number.')
			return
		}
		if (Number(balance) < 1) {
			QuickError(message, 'Please provide a valid amount.')
			return
		}
		if (!Number(targetUser)) {
			try {
				//# get the ID of the user based on the mention
				targetUser = message.mentions.users.first().id
			} catch (error) {
				QuickError(
					message,
					`Please provide a valid user to transfer to -- Acceptable Format either via an @ mention, or the user's ID`,
				)
				return
			}
		}
		var transferModule = await transferbalance(message, targetUser, balance)
	}
}
