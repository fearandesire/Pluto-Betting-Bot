import { Command, container } from '@sapphire/framework'
import _ from 'lodash'
import accounting from 'accounting'
import flatcache from 'flat-cache'
import storage from 'node-persist'
import { Spinner } from '@favware/colorette-spinner'
import {
	serverEnv,
	SEASON_TYPE,
	SPORT,
} from '@pluto-server-config'
import { QuickError, embedReply } from '@pluto-embed-reply'
import { Log } from '@pluto-internal-logger'

import dmMe from '../utils/bot_res/dmMe.js'

import { findEmoji } from '../utils/bot_res/findEmoji.js'

const spinner = new Spinner()

export { spinner }

// ? Exporting Console Logging Colors for other files to use
export {
	bgYellowBright,
	blue,
	blueBright,
	bold,
	green,
	magentaBright,
	red,
	yellow,
	yellowBright,
} from 'colorette'

// ? Common Imports for other files to use
export {
	container,
	Command,
	storage,
	_,
	Log,
	QuickError,
	embedReply,
	flatcache,
	accounting,
	dmMe,
	findEmoji,
}

export const formatCurrency = (
	value,
	currency = '$',
	precision = 0,
	thousandSeparator = ',',
	decimalSeparator = '.',
) =>
	accounting.formatMoney(
		value,
		currency,
		precision,
		thousandSeparator,
		decimalSeparator,
	)

// ? Leaderboard memory cache
container.leaderboardCache = ''

// ? A border to place between console log returns to maintain readability
export const cborder = `    =========          =========          =========    `

container.lastTime = 0

// ? A check to see if the teams & odds are already collected for the day
container.CollectedOdds = false
//* «««««««««««««« */

// ? Claim Times Container
container.ClaimTimes = {}

// ? RegEx to disallow any letter characters
export const disallowLetters = /[a-z]/gi

// ? OBJ to store the matchups themselves
container.TodaysMatchups = {}

// ? Footer for embeds, since direct strings are depricated.
export const embedfooter = 'DM `fenixforever` for support'
export const helpfooter = 'dev. by fenixforever'

// ? Obj for currency updates
container.newBal = {}

// # boolean to know if the shceduling is already set [using the arr below now, though]
container.fetchedAlready = false

// # To store & view the current game channels scheduled
export const gamesScheduled = []

//  # Pre-season status
export const isPreSzn = () => {
	if (SEASON_TYPE === 'preseason') {
		return true
	}
	return false
}

// eslint-disable-next-line import/no-mutable-exports
let dayOrder
if (SPORT === 'nfl') {
	dayOrder = [
		'Thursday',
		'Friday',
		'Saturday',
		'Sunday',
		'Monday',
		'Tuesday',
		'Wednesday',
	]
} else if (SPORT === 'nba') {
	dayOrder = [
		'Monday',
		'Tuesday',
		'Wednesday',
		'Thursday',
		'Friday',
		'Saturday',
		'Sunday',
	]
} else {
	dayOrder = false
}

export function orderByDays(games, order) {
	return _.orderBy(
		Object.entries(games),
		([day]) => _.indexOf(order, day),
		['asc'],
	)
}

export { dayOrder }

const {
	ODDS,
	SCORE,
	PENDING,
	BETSLIPS,
	CURRENCY,
	PROFILES,
	LIVEMATCHUPS,
	SCORETABLE,
	LIVEBETS,
	EXPERIENCE,
	server_ID,
	gameCat_ID,
	sportsLogo,
	bettingChan,
	logChan,
	gameHeartbeat,
	scheduledGames,
	getRanges,
} = serverEnv

export {
	sportsLogo,
	SCORETABLE,
	LIVEMATCHUPS,
	LIVEBETS,
	BETSLIPS,
	PROFILES,
	PENDING,
	SCORE,
	EXPERIENCE,
	ODDS,
	CURRENCY,
	SEASON_TYPE,
	server_ID,
	gameCat_ID,
	bettingChan,
	logChan,
	gameHeartbeat,
	scheduledGames,
	getRanges,
}
