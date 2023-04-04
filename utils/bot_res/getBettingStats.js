/* eslint-disable no-console */
import _ from 'lodash'
import { db } from '#db'
import { statsEmbedBuilder } from '#botUtil/statsEmbBuilder'
import { embedReply, BETSLIPS } from '#config'
import { SapDiscClient } from '#main'

export async function getBettingStats(options) {
	console.log(`Getting all users betting stats...`)
	const results = await db.any(`
    SELECT userid, amount, betresult, dateofbet, profit, teamid
    FROM "${BETSLIPS}"
  `)
	if (!results) {
		throw new Error(`No results found for stat collection.`)
	}
	if (!options) {
		return new Error(`No options provided for stat collection.`)
	}
	if (options?.type === 'individual') {
		const userBets = _.filter(results, { userid: options.id })
		// # Find username from ID
		const user = await SapDiscClient.users.fetch(options.id)
		let { username } = user
		if (options?.interaction && options.id === options?.interaction.user.id) {
			username = 'Your'
		}
		const indvEmbedObject = await statsEmbedBuilder(userBets, username)
		await embedReply(options.interaction, indvEmbedObject)
	} else if (options?.type === 'all') {
		const topEmbedObject = await statsEmbedBuilder(results, 'All users')
		await embedReply(options.interaction, topEmbedObject)
	}
}
