import { Command } from '@sapphire/framework'
import _ from 'lodash'
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

// ? Embed usage
const helpfooter = '💙 Support Pluto via Patreon | Use `/patreon` for more info'

// ? General Config
export { helpfooter, Command, _, Log, findEmoji }
