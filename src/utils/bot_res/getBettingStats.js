/* eslint-disable no-console */
import _ from 'lodash'
import db from '@pluto-db'
import { statsEmbedBuilder } from '@pluto-stats-embed-builder'
import { embedReply, BETSLIPS } from '@pluto-core-config'
import { SapDiscClient } from '@pluto-core'

export async function getBettingStats(options) {
	const results = await db.any(`
    SELECT userid, amount, betresult, dateofbet, profit, teamid
    FROM "${BETSLIPS}"
  `)
	if (!results || _.isEmpty(results)) {
		return 204
	}
	if (!options) {
		return new Error(
			`No options provided for stat collection.`,
		)
	}
	if (options?.type === 'individual') {
		// # Find username from ID
		const user = await SapDiscClient.users.fetch(
			options.id,
		)
		let { username } = user
		if (
			options?.interaction &&
			options.id === options?.interaction.user.id
		) {
			username = 'Your'
		}
		const userBetsFiltered = await results.filter(
			(row) => {
				if (
					(Number(row.amount) !== 0 ||
						Number(row.profit) >= 1) &&
					row.userid === options.id
				) {
					return true
				}
				return false
			},
		)
		const indvEmbedObject = await statsEmbedBuilder(
			userBetsFiltered,
			username,
		)
		await embedReply(
			options.interaction,
			indvEmbedObject,
		)
	} else if (options?.type === 'all') {
		console.log(results)
		const filteredResults = await results.filter(
			(row) => {
				if (
					Number(row.amount) !== 0 ||
					Number(row.profit) >= 1
				) {
					return true
				}
				return false
			},
		)
		const topEmbedObject = await statsEmbedBuilder(
			filteredResults,
			'All users',
		)
		await embedReply(
			options.interaction,
			topEmbedObject,
		)
	}
}
