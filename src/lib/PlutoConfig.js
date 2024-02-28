import { Command } from '@sapphire/framework'
import _ from 'lodash'
import accounting from 'accounting'
import { SEASON_TYPE, serverEnv } from '@pluto-server-config'
import { embedReply, QuickError } from '@pluto-embed-reply'
import { Log } from '@pluto-internal-logger'
import { findEmoji } from '../utils/bot_res/findEmoji.js'

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

//  # REVIEW: Pre-season status
export const isPreSzn = () => {
	return SEASON_TYPE === 'preseason'
}

// ? Embed usage
const helpfooter = 'dev. by fenixforever'

// ? General Config
export {
	helpfooter,
	Command,
	_,
	Log,
	QuickError,
	embedReply,
	accounting,
	findEmoji,
}

// # DB Configs
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
