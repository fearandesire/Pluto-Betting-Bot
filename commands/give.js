import { giveBalance } from '#cmdUtil/giveBalance'
import { QuickError } from '#config'
import { Command } from '@sapphire/framework'

export class give extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'give',
			aliases: [``],
			description: 'Give credits to a specified user',
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
		await giveBalance(message, targetUser, balance)
	}
}
