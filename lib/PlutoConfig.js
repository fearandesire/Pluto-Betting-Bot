import 'dotenv/config'

import { Command, container } from '@sapphire/framework'
import { QuickError, embedReply } from '#embed'

import { Log } from '#LogColor'
import _ from 'lodash'
import accounting from 'accounting'
import flatcache from 'flat-cache'
import { queryBuilder } from '#qBuilder'
import storage from 'node-persist' //? node-persist: using to keep a local record for validation of a user's bets being collected already, or not [listbets.js]

//# db query builder
export { queryBuilder }

//? Exporting Console Logging Colors for other files to use
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
//? Common Imports for other files to use
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
}

// ? Leaderboard memory cache
container.leaderboardCache = ''

//? A border to place between console log returns to maintain readability
export const cborder = `    =========          =========          =========    `

//? Keyword to log to console
export const logthis = console.log

//& To hold the cron time
container.cronRanges = {}

container.lastTime = 0
//* «««««««««««««« */

//* ODDS RELATED »»»»»»»»» */
//? I believe Team1 will be the home teams and Team2 will be the away teams, but we can't be 100% sure until the season starts.
container.Team1List = []
container.Team1Odds = []
container.Team2List = []
container.Team2Odds = []
export const Team1List = container.TeamList
export const Team1Odds = container.TeamOdds
export const Team2List = container.TeamList
export const Team2Odds = container.TeamOdds
//? A check to see if the teams & odds are already collected for the day
container.CollectedOdds = false
//* «««««««««««««« */

//? NBAC Logo URL
export const NBACLogo =
    'https://cdn.discordapp.com/attachments/515598020818239491/981652760325922836/NBACPrideLogo.gif?size=4096'

//? Claim Times Container
container.ClaimTimes = {}

//? RegEx to disallow any letter characters
export const disallowLetters = /[a-z]/gi

//? OBJ to store the matchups themselves
container.TodaysMatchups = {}

//? Footer for embeds, since direct strings are depricated.
export const embedfooter = 'Provided by Pluto | DM FENIX#7559 for support'
export const helpfooter = 'Pluto | Designed by FENIX#7559'
//? Object for storing active bet list per user [listMyBets.js]
export const Memory_Betslips = {}
container.test_BetSlip = {}
container.userSlipArr = {}
//? Obj for currency updates
container.newBal = {}

//# boolean to know if the shceduling is already set [using the arr below now, though]
container.fetchedAlready = false

//# To store & view the current game channels scheduled
export let gamesScheduled = []

export const NFL_CRON_THUR = process.env.NFL_CRON_THUR
export const NFL_CRON_MON = process.env.NFL_CRON_MON
export const NFL_CRON_SUN = process.env.NFL_CRON_SUN
export const ODDS_NFL = process.env.odds_API_NFLODDS
export const NFL_SCORE = process.env.odds_API_NFLSCORE
export const NFL_ACTIVEMATCHUPS = process.env.NFL_ACTIVEMATCHUPS
export const NFL_MATCHES = process.env.NFL_MATCHES
export const NFL_LIVEBETS = process.env.NFL_LIVEBETS
export const NFL_BETS = process.env.NFL_BETS
export const NFL_PROFILES = process.env.NFL_PROFILES
export const NFL_PENDING = process.env.NFL_PENDING
export const NFL_COLLECT_CRONTIMES = process.env.NFL_COLLECT_CRONTIMES
export const NFL_NEWSCHED_CHECK = process.env.NFL_NEWSCHED_CHECK

export const SCHEDULE_TIMER = process.env.SCHEDULE_TIMER
export const CHECK_COMPLETED_TIMER = process.env.CHECK_COMPLETED_TIMER
export const LIVEMATCHUPS = process.env.LIVEMATCHUPS
export const LIVEBETS = process.env.LIVEBETS
export const BETSLIPS = process.env.BETSLIPS
export const PROFILE = process.env.PROFILE
export const PENDING = process.env.PENDING
export const SCORE = process.env.SCORE
export const ODDS = process.env.ODDS
export const CURRENCY = process.env.CURRENCY
