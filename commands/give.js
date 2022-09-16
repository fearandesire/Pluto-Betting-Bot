import { Command } from '@sapphire/framework'
import { QuickError } from '#config'
import { giveBalance } from '#cmdUtil/giveBalance'
import { transferTo } from '../utils/db/transferBetween.js'
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
        let amount = await args.pick('string').catch(() => null)
        let force = await args.pick('string').catch(() => null)
        if (!targetUser || !amount) {
            QuickError(message, 'Please provide a valid user and an amount')
            return
        }
        if (amount.includes(`.`)) {
            QuickError(message, 'Please provide a whole number.')
            return
        }
        if (Number(amount) < 1) {
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
        var userId = message.author.id
        if (force !== null && message.member.permissions.has(`KICK_MEMBERS`)) {
            await giveBalance(message, targetUser, amount)
        } else {
            if (force === null) {
                transferTo(message, userId, targetUser, amount)
            }
        }
    }
}
