import { Command, container } from '@sapphire/framework'
import _ from 'lodash'
import accounting from 'accounting'
import flatcache from 'flat-cache'
import storage from 'node-persist'
import { Spinner } from '@favware/colorette-spinner'
import { queryBuilder } from '#qBuilder'
import { Log } from '#LogColor'
import { QuickError, embedReply } from '#embed'

import {
    CONFIG_TBL,
    SCHEDULE_TIMER,
    CHECK_COMPLETED_TIMER,
    LIVEMATCHUPS,
    LIVEBETS,
    BETSLIPS,
    PROFILES,
    PENDING,
    SCORE,
    ODDS,
    CURRENCY,
    GOOGLE_CUSTOM,
    COLUMN_MATCHUPS_DATE,
    COLUMN_MATCHUPS_HOME_TEAM,
    COLUMN_MATCHUPS_AWAY_TEAM,
    PRESZN_MATCHUPS_TABLE,
    SEASON_TYPE,
} from '#env'

import dmMe from '../utils/bot_res/dmMe.js'

import { findEmoji } from '../utils/bot_res/findEmoji.js'

const spinner = new Spinner()

export { spinner }

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
export const embedfooter =
    'Provided by Pluto | DM `fenixforever` for support'
export const helpfooter = 'Pluto | Dev. by fenixforever'

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

export {
    SCHEDULE_TIMER,
    CHECK_COMPLETED_TIMER,
    LIVEMATCHUPS,
    LIVEBETS,
    BETSLIPS,
    PROFILES,
    PENDING,
    SCORE,
    ODDS,
    CURRENCY,
    GOOGLE_CUSTOM,
    COLUMN_MATCHUPS_DATE,
    COLUMN_MATCHUPS_HOME_TEAM,
    COLUMN_MATCHUPS_AWAY_TEAM,
    PRESZN_MATCHUPS_TABLE,
    SEASON_TYPE,
    CONFIG_TBL,
}
