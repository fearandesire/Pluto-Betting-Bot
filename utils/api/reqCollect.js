import { reply } from '../bot_res/reply.js'
import collectOdds from './collectOdds.js'

/**
 * Manual/Force request of an attempt to collect odds.
 * This function exists to communicate between the user and the response of the odd collection module (collectOdds)
 * @function reqCollect
 */

export async function reqCollect(interaction) {
	await collectOdds(interaction).then(async (resp) => {
		if (resp === false) {
			await reply(
				interaction,
				`Currently it appears there's no odds available. Please try again another time`,
				true,
			)
		} else {
			await reply(interaction, `Odds have been collected successfully.`)
		}
	})
}
