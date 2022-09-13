import { Command } from '@sapphire/framework'
import { leaderboard } from './../utils/cmd_res/leaderboard.js'

export class leaderboarding extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'leaderboard',
			aliases: ['leaderboard'],
			description: 'leaderboard command',
		})
	}
	async messageRun(message) {
		await leaderboard(message)
	}
}
