import { Command } from '@sapphire/framework'
import { leaderboard } from './../utils/cmd_res/leaderboard.js'

export class viewLeaderboard extends Command {
    constructor(context, options) {
        super(context, {
            ...options,
            name: 'viewleaderboard',
            aliases: [''],
            description: 'leaderboard command',
        })
    }
    async messageRun(message) {
        await leaderboard(message)
    }
}
