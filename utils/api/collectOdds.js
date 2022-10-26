import { container, embedReply } from '#config'
import {
	format,
	formatISO,
	getDay,
	getHours,
	getMinutes,
	parseISO,
} from 'date-fns'

import { ODDS_NBA } from '../../lib/PlutoConfig.js'
import _ from 'lodash'
import { assignMatchID } from '#botUtil/AssignIDs'
import { collectOddsLog } from '../logging.js'
import { createMatchups } from '#utilMatchups/createMatchups'
import fetch from 'node-fetch'
import flatcache from 'flat-cache'
import { gameDaysCache } from '../cache/gameDaysCache.js'
import { isExactMatchup } from '../db/validation/isExactMatchup.js'
import { msgBotChan } from '#botUtil/msgBotChan'
import { resolveDayName } from '../bot_res/resolveDayName.js'
import { resolveIso } from '#dateUtil/resolveIso'
import { resolveToday } from '#dateUtil/resolveToday'
import { scheduleChannels } from '../db/gameSchedule/scheduleChannels.js'
import stringifyObject from 'stringify-object'

let oddsCache = flatcache.create(`oddsCache.json`, './cache/dailyOdds')

/**
 * @module collectOdds
 * Call the API and store the matchup odds for the day into the database & cache
 */

export async function collectOdds(message) {
	if (!message) {
		message == null
	}
	const url = ODDS_NBA
	const options = {
		method: 'GET',
		headers: {
			'X-RapidAPI-Host': 'api.the-odds-api.com',
			// eslint-disable-next-line no-undef
			'X-RapidAPI-Key': process.env.odds_API_XKEY,
		},
	}
	let matchups = {} //# to store matchups into cache
	container.allNbaOdds = {}
	await fetch(url, options)
		.then((res) => res.json())
		.then((json) => {
			collectOddsLog.info(`Initializing collection of odds for the day`)
			//? Returns the list of matchups
			var apiGamesList = json
			container.allNbaOdds = apiGamesList
		})
	var allNbaOdds = container.allNbaOdds
	container.matchupCount = 0
	for (let [key, value] of Object.entries(allNbaOdds)) {
		let isoDate = value.commence_time
		//# Storing games that are scheduled for this week || API can return games for the next week, but they have no odds.
		let todayDateInfo = new resolveToday()
		let weekNum = todayDateInfo.weekNum
		let apiDateInfo = new resolveIso(isoDate)
		let apiWeekNum = apiDateInfo.weekNum
		var gameDay = apiDateInfo.dayNum
		var monthNum = apiDateInfo.month
		var gameYear = apiDateInfo.year
		var apiDoW = apiDateInfo.dayOfWeek
		var nextWeek = parseInt(weekNum) + 1 //# Fetch Monday Games
		var gameDate = `${monthNum}/${gameDay}/${gameYear}`
		//# Prevent duplication of matchups in the database
		var dupeDBMatchup = await isExactMatchup(
			value.home_team,
			value.away_team,
			gameDate,
		)
		if (dupeDBMatchup == true) {
			collectOddsLog.info(
				`Matchup already exists in DB: ${value.home_team} vs ${value.away_team} on date: ${gameDate} -- This matchup will not be stored.`,
			)
			await msgBotChan(
				`**${value.home_team} vs ${value.away_team}** on date: **${gameDate}** already exists in DB -- This matchup will __not__ be stored.`,
			)
			continue
		}
		if (
			apiWeekNum === weekNum ||
			(apiWeekNum === nextWeek && apiDoW === 'Mon')
		) {
			await collectOddsLog.info(
				`Storing Matchup: ${value.home_team} vs ${value.away_team}\nToday's Week: ${weekNum} | API Week: ${apiWeekNum} | Next Week: ${nextWeek} Game Day: ${apiDoW}`,
			)
			container.matchupCount++
			//# the current day and time
			let currentDay = todayDateInfo.dayNum
			let currentHour = todayDateInfo.hour
			let currentMinute = todayDateInfo.minute
			//# game start day & time
			let apiStartDay = apiDateInfo.dayNum
			let apiStartHour = apiDateInfo.hour
			let apiStartMin = apiDateInfo.minute
			let gameStartTime = `${apiStartDay}${apiStartHour}${apiStartMin}`
			let fullStartTime = `Start Info\nDay: ${apiStartDay} Hour: ${apiStartHour} Minute: ${apiStartMin}`
			let home_odds
			let away_odds
			var home_team = value.home_team
			var away_team = value.away_team
			var selectedOdds = value?.bookmakers[0]?.markets[0].outcomes
				? value.bookmakers[0]?.markets[0].outcomes
				: null
			if (selectedOdds) {
				home_odds = selectedOdds[1].price
				away_odds = selectedOdds[0].price
			} else {
				home_odds = 'n/a'
				away_odds = 'n/a'
			}
			//# date-fns to parse the ISO, get the start time & format it for Cron Jobs
			var gameTime = parseISO(isoDate)
			var startHour = getHours(gameTime)
			var startMin = getMinutes(gameTime)
			var startDay = getDay(gameTime)
			var startDayOfMonth = Number(format(gameTime, `d`))
			var startMonth = Number(format(gameTime, `M`))
			var cronStartTime = `${startMin} ${startHour} ${startDayOfMonth} ${startMonth} ${startDay}`
			//# Format ISO to be used for game start times in a quick gameActive check
			var startTimeISO = formatISO(gameTime, { representation: 'complete' })
			await collectOddsLog.info(
				`Matchup: ${home_team} vs ${away_team} | Cron Start Time: ${cronStartTime}`,
			)
			let matchupId = await assignMatchID()
			var dayName = await resolveDayName(startDay)
			if (startMin.toString().length === 1) {
				startMin = `${startMin}0`
			}
			var amOrPm
			if (startHour > 12) {
				amOrPm = 'PM'
				startHour = startHour - 12
			}
			var legibleStartTime = `${dayName}, ${startHour}:${startMin} ${amOrPm}`
			matchups[`${matchupId}`] = {
				[`home_team`]: home_team,
				[`away_team`]: away_team,
				[`home_teamOdds`]: home_odds,
				[`away_teamOdds`]: away_odds,
				[`matchupId`]: matchupId,
				[`startTime`]: gameStartTime,
				[`fullStartTime`]: fullStartTime,
				[`mdyDate`]: gameDate, //* date formatted as month/day/year
				[`dayNum`]: apiStartDay,
				[`dayOfWeek`]: gameDay,
				[`hour`]: apiStartHour,
				[`minute`]: apiStartMin,
				[`gameDayName`]: apiDoW,
				[`cronStartTime`]: cronStartTime,
				[`legibleStartTime`]: legibleStartTime,
			}
			await collectOddsLog.info(
				`== Storing Matchup into cache: ==\n${stringifyObject(
					matchups[matchupId],
				)}`,
			)
			// date-fns will format '00' minutes as '0' | adding a zero to make it more legible
			//# matchups to DB
			await createMatchups(
				message,
				home_team,
				away_team,
				home_odds,
				away_odds,
				matchupId,
				gameDate,
				startTimeISO,
				cronStartTime,
				legibleStartTime,
			)
			//# game channel creation
			await scheduleChannels(
				home_team,
				away_team,
				cronStartTime,
				legibleStartTime,
			)
			//# save day of the week names to cache for daily embeds to staff
			await gameDaysCache(dayName)
		} else {
			collectOddsLog.info(
				`== Matchup not stored: ==\n${value.home_team} vs ${value.away_team}\nToday's Week: ${weekNum} | API Week: ${apiWeekNum} | Next Week: ${nextWeek} Game Day: ${apiDoW}`,
			)
			continue
		}
	}
	if (_.isEmpty(matchups)) {
		await msgBotChan(
			`Issue occured while collecting & storing matchups. No Information has been stored.`,
			`error`,
		)
		collectOddsLog.error(
			`Issue occured while collecting & storing matchup. No Information has been stored.`,
		)
		return
	}
	collectOddsLog.info(
		`All Matchup information collected:\n${stringifyObject(matchups)}`,
	)
	await oddsCache.setKey(`matchups`, matchups)
	await oddsCache.save(true)
	collectOddsLog.info(
		`Successfully gathered odds for the day.\nOdds are stored into cache & db\n# Of Matchups Stored: (${container.matchupCount})`,
	)
	if (message !== null) {
		setTimeout(async () => {
			var embObj = {
				title: `Matchup Scheduling`,
				description: `**${container.matchupCount}** Matchups have been scheduled for the day!`,
				color: `#8000ff`,
				target: `modBotSpamID`,
			}
			await embedReply(message, embObj)
		}, 10000)
		return
	}
	if (message == null) {
		setTimeout(() => {
			msgBotChan(
				`Odds stored into cache & db. (# Of Matches: ${container.matchupCount})`,
			)
		}, 10000)
		return
	}
}
