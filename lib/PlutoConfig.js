import { Command, container } from '@sapphire/framework'
import _ from 'lodash'
import accounting from 'accounting'
import flatcache from 'flat-cache'
import storage from 'node-persist'
import { queryBuilder } from '#qBuilder'
import { Log } from '#LogColor'
import { QuickError, embedReply } from '#embed'
import dmMe from '../utils/bot_res/dmMe.js'
import { findEmoji } from '../utils/bot_res/findEmoji.js'
import {
	SCHEDULE_TIMER,
	CHECK_COMPLETED_TIMER,
	LIVEMATCHUPS,
	LIVEBETS,
	BETSLIPS,
	PROFILE,
	PENDING,
	SCORE,
	ODDS,
	CURRENCY,
} from '#env'

// # db query builder
export { queryBuilder }

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

// ? Keyword to log to console
export const logthis = console.log

// & To hold the cron time
container.cronRanges = {}

container.lastTime = 0
//* «««««««««««««« */

//* ODDS RELATED »»»»»»»»» */
// ? I believe Team1 will be the home teams and Team2 will be the away teams, but we can't be 100% sure until the season starts.
container.Team1List = []
container.Team1Odds = []
container.Team2List = []
container.Team2Odds = []
export const Team1List = container.TeamList
export const Team1Odds = container.TeamOdds
export const Team2List = container.TeamList
export const Team2Odds = container.TeamOdds
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
export const embedfooter = 'Provided by Pluto | DM FENIX#7559 for support'
export const helpfooter = 'Pluto | Designed by FENIX#7559'
// ? Object for storing active bet list per user [listMyBets.js]
export const Memory_Betslips = {}
container.test_BetSlip = {}
container.userSlipArr = {}
// ? Obj for currency updates
container.newBal = {}

// # boolean to know if the shceduling is already set [using the arr below now, though]
container.fetchedAlready = false

// # To store & view the current game channels scheduled
export const gamesScheduled = []

export {
	SCHEDULE_TIMER,
	CHECK_COMPLETED_TIMER,
	LIVEMATCHUPS,
	LIVEBETS,
	BETSLIPS,
	PROFILE,
	PENDING,
	SCORE,
	ODDS,
	CURRENCY,
}
