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
	'🃏 Addicted? Call 1-800-GAMBLER',
];

const bettingFooters = [
	'🦄 Unicorns are real, and so are your chances of winning... maybe',
	"🐳 Whale alert! Oh wait, that's just your ambition",
	"🔮 Our crystal ball says you'll win... but it's been wrong before",
	'🚀 To the moon! Or at least to the next payout',
	'🦸‍♀️ You are guaranteed to win! (results may vary)',
];

const placedBetFooters = [
	'🧙‍♂️ Abracadabra! Your money has magically disappeared!',
];

function helpfooter() {
	const randomIndex = Math.floor(Math.random() * footers.length);
	return footers[randomIndex];
}
// ? General Config
export { helpfooter, Log, findEmoji, appOwner };
