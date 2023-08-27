import _ from 'lodash'
import { isToday, isYesterday, parseISO } from 'date-fns'
import { PRESZN_MATCHUPS_TABLE } from '#config'
import { db } from '#db'
import { getShortName } from '../bot_res/getShortName.js'
import { queueDeleteChannel } from '../db/gameSchedule/queueDeleteChannel.js'
import locateChannel from '../bot_res/locateChan.js'
import logClr from '#colorConsole'
import { deleteCompletedMatches } from '../db/matchupOps/deleteCompleted.js'

export async function preseasonGameHeartbeat() {
	// await logClr({
	// 	text: `Checking for completed preseason games`,
	// 	status: `processing`,
	// 	color: `yellow`,
	// })

	const completedGames = await db.manyOrNone(
		`SELECT * FROM "${PRESZN_MATCHUPS_TABLE}" WHERE completed = true`,
	)

	if (_.isEmpty(completedGames)) {
		// await logClr({
		// 	text: `No completed games found!`,
		// 	color: `green`,
		// 	status: `done`,
		// })
		return
	}

	// Filter games that are within today or the prior today
	const filterGames = _.filter(completedGames, (game) => {
		const gameDate = parseISO(game.date)
		const criteria =
			isToday(gameDate) || isYesterday(gameDate)
		if (criteria) {
			return criteria
		}
	})

	// await logClr({
	//     text: `Processing ${filterGames.length} game(s) to create a queued deletion of their game channels, if they exist. `,
	//     status: `processing`,
	//     color: `yellow`,
	// })

	const deletionTally = [0]
	_.forEach(filterGames, async (game) => {
		// # Queue game channel to be closed in 30 minutes
		const hTeamShort = await getShortName(
			game.home_team,
		)
		const aTeamShort = await getShortName(
			game.away_team,
		)

		const chanName = `${aTeamShort}-vs-${hTeamShort}`

		const channelExists = await locateChannel(chanName)
		if (!channelExists) {
			await logClr({
				text: `Unable to locate channel ${chanName} - It was likely deleted prior.`,
				status: `error`,
				color: `red`,
			})
			await deleteCompletedMatches(true, game.id)
			return
		}
		deletionTally[0] += 1
		await queueDeleteChannel(chanName)
		await logClr({
			text: `Queued ${chanName} to be deleted`,
			color: `blue`,
		})
		await deleteCompletedMatches(true, game.id)
	})
	// await logClr({
	// 	text: `Completed game channel deletion que process. =>\n Count: ${deletionTally} `,
	// 	status: `done`,
	// 	color: `green`,
	// })
}
