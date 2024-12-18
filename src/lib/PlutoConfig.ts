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
	'💲 Use /balance to check your profile',
	'👁️ Use /commands to see all commands',
	'❓ Learn more about Pluto via /help',
	'📞 Addicted? Call 1-800-GAMBLER',
	'🌟 Pluto: Not just a dwarf planet, but a stellar bot!',
];

const gamblerFooters = [
	'🧙‍♂️ You shall not pass... up another bet! - Gandalf the Broke',
	'🚀 To infinity and beyond... goes your credit card bill!',
	'🕷️ With great bets comes great responsibility - Uncle Ben, probably',
	"🃏 Why so serious? Let's put a dent in that bank account!",
	"🏆 May the odds be ever in your favor... but they probably won't be.",
	'📞 Addicted? Call 1-800-GAMBLER',
];

const bettingFooters = [
	'🦄 Unicorns are real, and so are your chances of winning... maybe',
	"🐳 Whale alert! Oh wait, that's just your ambition",
	"🔮 Our crystal ball says you'll win... but it's been wrong before",
	'🚀 To the moon! Or at least to the next payout',
	'🦸‍♀️ You are guaranteed to win! (results may vary)',
	...gamblerFooters,
];

const placedBetFooters = [
	'🧙‍♂️ Abracadabra! Your money has magically disappeared!',
];

type FooterTypes = 'default' | 'betting' | 'placedBet' | 'gambler' | 'all';
function randomFooter(type: FooterTypes = 'default'): string {
	let selectedFooters: string[];

	switch (type) {
		case 'betting':
			selectedFooters = bettingFooters;
			break;
		case 'placedBet':
			selectedFooters = placedBetFooters;
			break;
		case 'gambler':
			selectedFooters = gamblerFooters;
			break;
		case 'all':
			selectedFooters = [
				...footers,
				...bettingFooters,
				...placedBetFooters,
				...gamblerFooters,
			];
			break;
		default:
			selectedFooters = footers;
	}

	const randomIndex = Math.floor(Math.random() * selectedFooters.length);
	return selectedFooters[randomIndex];
}

const supportMessage = 'Please reach out to `fenixforever` for support.';

export { randomFooter as helpfooter, Log, findEmoji, appOwner, supportMessage };
