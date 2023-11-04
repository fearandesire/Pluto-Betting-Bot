import _ from 'lodash'
import { isToday, isYesterday, parseISO } from 'date-fns'
import { db } from '#db'
import logClr from '#colorConsole'
import { SCORETABLE } from '#serverConf'
import { MatchupManager } from '#MatchupManager'
import { handleBetMatchups } from './handleBetMatchups.js'
import { getShortName } from '../getShortName.js'
import { queueDeleteChannel } from '../../db/gameSchedule/queueDeleteChannel.js'
import locateChannel from '../locateChan.js'

// TODO: Implement score tracking features with heartbeat

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

		// # Sort of a hack around the APIs being used: We only remove the match from the score table if there's no outstanding bets
		// # This is done for two reasons: Limit API calls from The-Odds API as there can be a gap in time before the game is set to 'complete' for them
		// # Secondly, we don't want to remove the game from the score table if there are outstanding bets - as currently,the score table is used to check for completes games, and no longer The-Odds-API
		// # Another solution would be to remove completed checks from handleBetMatchups, or passing in the game ID and winner to handleBetMatchups directly
		const betsExisting =
			await MatchupManager.outstandingBets(
				game.id,
				db,
			)
		if (!betsExisting) {
			// ! Remove from Score Tbl
			await MatchupManager.clearScoreTable(game.id)
			deletionTally[0] += 1
		}
	})
	// await logClr({
	// 	text: `Completed game channel deletion que process. =>\n Count: ${deletionTally} `,
	// 	status: `done`,
	// 	color: `green`,
	// })
}
