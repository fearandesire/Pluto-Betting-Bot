import { Log } from '../utils/bot_res/consoleLog.js';
import { findEmoji } from '../utils/bot_res/findEmoji.js';

const appOwner = process.env.APP_OWNER_ID;

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
} from 'colorette';

// ? Embed usage
const footers = [
	'💲 Use /balance to check your profile & level',
	'👁️ Use /commands to see all commands',
	'❓ Learn more about Pluto via /help',
];

function helpfooter() {
	const randomIndex = Math.floor(Math.random() * footers.length);
	return footers[randomIndex];
}
// ? General Config
export { helpfooter, Log, findEmoji, appOwner };
