import { Memory_Betslips, storage } from '../../lib/PlutoConfig.js'
import { QuickError, embedReply } from '../bot_res/send_functions/embedReply.js'
import { FileRunning } from '../bot_res/classes/FileRunning.js'
import { Log } from '../bot_res/send_functions/consoleLog.js'
import { db } from '../../Database/dbindex.js'
import { container } from '@sapphire/pieces'
import { MessageFlags } from 'discord.js'

export function leaderboard(message) {
	return db

		.map(
			`SELECT userid,balance FROM currency ORDER BY balance DESC NULLS LAST`,
			['123'],
			(row) => {
				container.userid = row.userid
				container.balance = row.balance

				var leaderEntry = `<@${container.userid}>: ${container.balance}`

				container.memory_balance = container.memory_balance || {}
				container.memory_balance.leaderboard =
					container.memory_balance.leaderboard || []
				container.test = 'test'

				container.memory_balance.leaderboard.push(leaderEntry)
			},
		)
		.then(async function handleResp() {
			var userBalance = container.memory_balance.leaderboard.join('\n')

			console.log(userBalance)
			await message.reply(userBalance)
		})
}
