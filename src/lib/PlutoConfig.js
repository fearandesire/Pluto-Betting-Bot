import { Command, container } from '@sapphire/framework'
import _ from 'lodash'
import accounting from 'accounting'
import { Spinner } from '@favware/colorette-spinner'
import {
	serverEnv,
	SEASON_TYPE,
} from '@pluto-server-config'
import { QuickError, embedReply } from '@pluto-embed-reply'
import { Log } from '@pluto-internal-logger'
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
	_,
	Log,
	QuickError,
	embedReply,
	accounting,
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

// ? A border to place between console log returns to maintain readability
export const cborder = `    =========          =========          =========    `

// ? Footer for embeds, since direct strings are depricated.
export const embedfooter =
	'Provided by Pluto | DM `fenixforever` for support'
export const helpfooter = 'Pluto | Dev. by fenixforever'

//  # Pre-season status
export const isPreSzn = () => {
	if (SEASON_TYPE === 'preseason') {
		return true
	}
	return false
}

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
