import _ from 'lodash'
import { isToday, isYesterday, parseISO } from 'date-fns'
import { db } from '#db'
import { handleBetMatchups } from '#api/handleBetMatchups'
import { getShortName } from '../bot_res/getShortName.js'
import { queueDeleteChannel } from '../db/gameSchedule/queueDeleteChannel.js'
import locateChannel from '../bot_res/locateChan.js'
import logClr from '#colorConsole'
import { SCORETABLE } from '#serverConf'
import { MatchupManager } from '#MatchupManager'

/**
 * @function getHeartbeat
 * Checks for completed games.
 * Upon finding a completed game:
 * - Remove from Score Tbl in DB
 * - Queue Game Channel to be deleted
 * - Close bets
 */
export async function getHeartbeat() {
	// await logClr({
	// 	text: `Checking for completed preseason games`,
	// 	status: `processing`,
	// 	color: `yellow`,
	// })

	const completedGames = await db.manyOrNone(
		`SELECT * FROM "${SCORETABLE}" WHERE completed = true`,
	)

	if (_.isEmpty(completedGames)) {
		// await logClr({
		// 	text: `No completed games found!`,
		// 	color: `green`,
		// 	status: `done`,
		// })
		return
	}

	// ? Filter games that are within today or the prior today
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
				text: `Unable to locate channel ${chanName} to be deleted`,
				status: `error`,
				color: `red`,
			})
		} else {
			await queueDeleteChannel(chanName)
			await logClr({
				text: `Queued ${chanName} to be deleted`,
				color: `blue`,
			})
		}
		// ! Close Bets
		await handleBetMatchups()
		// ! Remove from Score Tbl
		await MatchupManager.clearScoreTable(game.id)
		deletionTally[0] += 1
	})
	// await logClr({
	// 	text: `Completed game channel deletion que process. =>\n Count: ${deletionTally} `,
	// 	status: `done`,
	// 	color: `green`,
	// })
}
