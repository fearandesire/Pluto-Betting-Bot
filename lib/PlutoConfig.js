import 'dotenv/config'

import { Command, container } from '@sapphire/framework'
import { QuickError, embedReply } from '#embed'

import { Log } from '#LogColor'
import _ from 'lodash'
import flatcache from 'flat-cache'
import storage from 'node-persist' //? node-persist: using to keep a local record for validation of a user's bets being collected already, or not [listbets.js]

//* CONSOLE RELATED »»»»»»»»» */
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
}

//? A border to place between console log returns to maintain readability
export const cborder = `    =========          =========          =========    `

//? Keyword to log to console
export const logthis = console.log

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
export const NFL_COLLECT_CRONTIMES = process.env.NFL_COLLECT_CRONTIMES
export const NFL_NEWSCHED_CHECK = process.env.NFL_NEWSCHED_CHECK

export const NBA_CRON_9PM = process.env.NBA_CRON_9PM
export const NBA_CRON_5TO7PM = process.env.NBA_CRON_5TO7PM
export const NBA_CRON_11PM = process.env.NBA_CRON_11PM
export const NBA_CRON_OVERNIGHT = process.env.NBA_CRON_OVERNIGHT
export const NBA_completedCheckTimes = process.env.NBA_DAILYTIME
export const ODDS_NBA = process.env.odds_API_NBAODDS
export const NBA_SCORE = process.env.odds_API_NBASCORE
export const NBA_AMCHECK = process.env.NBA_CRON_AMCHECK
export const NBA_NEWSCHED_CHECK = process.env.NBA_NEWSCHED_CHECK
export const NBA_COLLECT_CRONTIMES = process.env.NBA_COLLECT_CRONTIMES
export const NBA_ACTIVEMATCHUPS = process.env.NBA_ACTIVEMATCHUPS

container.userIsBetting = {}
