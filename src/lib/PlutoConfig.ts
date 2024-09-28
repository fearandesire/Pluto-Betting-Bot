import { Command } from "@sapphire/framework";
import _ from "lodash";
import { Log } from "../utils/bot_res/consoleLog.js";
import { findEmoji } from "../utils/bot_res/findEmoji.js";

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
} from "colorette";

// ? Embed usage
const footers = [
	"❓ Learn more about Pluto via /help",
	// '💙 Support Pluto via /patreon',
];

function helpfooter() {
	const randomIndex = Math.floor(Math.random() * footers.length);
	return footers[randomIndex];
}
// ? General Config
export { helpfooter, Command, _, Log, findEmoji };
