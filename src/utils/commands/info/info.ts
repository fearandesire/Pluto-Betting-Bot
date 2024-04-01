import embedColors from '../../../lib/colorsConfig.js'
import { helpfooter } from '@pluto-core-config'

export default class PlutoInfo {
	static aboutInfo() {
		return {
			title: 'About Pluto',
			description: `
Pluto is a full-fledged betting bot with a strong focus on simplicity. You can securely place bets on NFL & NBA games and participate in the online betting scene without using real-life currency.
# :robot: __Pluto Features:__
◦ **H2H Wagers**
◦ **Real-Time Bet processing**
◦ **Real-Time Game Channel scheduling and deletion**
━━━━━━━━
Pluto uses virtual currency with real match odds from various bookmakers to simulate common popular betting sites & the real betting experience.
**For usage, please refer to the /help command!**
:heart: **Enjoy using Pluto? [Support development & server cost](https://ko-fi.com/fenix7559)**
:nerd: [GitHub](https://github.com/fearandesire/Pluto-Betting-Bot)
:question: For questions/concerns, contact me: **<@${process.env.APP_DEV_ID}>**`,
			thumbnail: `https://i.imgur.com/RWjfjyv.png`,
			color: embedColors.PlutoBlue,
			footer: `© fenixforever 2024 | Version: ${process.env.PROJECT_VERSION}`,
			target: `reply`,
		}
	}

	static commandsInfo() {
		const cmdList = {
			betting: {
				odds: "View the odds for this week's matches",
				bet: 'Place a bet on a matchup',
				cancelbet: "Cancel a pending bet you've placed",
				balance: 'View your current balance',
			},
			info: {
				stats: 'View your betting stats',
				leaderboard:
					"View the betting leaderboard, see who's on top and where you stand!",
				help: 'View information on how to use the bot',
				commands: 'View all commands available to you',
				bethistory: 'View the track record of your bets',
			},
		}

		// Formatting the commands into a string for display
		const formatCommands = (cmds: {
			[key: string]: { [key: string]: string }
		}) => {
			let formattedCommands = ''
			for (const [category, commands] of Object.entries(cmds)) {
				formattedCommands += `⭐ **__${category.charAt(0).toUpperCase() + category.slice(1)}__**\n` // Capitalize the first letter of each category name
				for (const [command, description] of Object.entries(commands)) {
					formattedCommands += `**\`/${command}\`** - ${description}\n`
				}
				formattedCommands += '\n'
			}
			return formattedCommands
		}

		// Construct the embed description with formatted commands and maintenance note
		const cmdDescription =
			formatCommands(cmdList) +
			`*Currently, the following commands are under maintenance:\n- \`bethistory\`\n- \`stats\`*`

		return {
			title: 'Pluto Commands',
			description: cmdDescription,
			thumbnail: 'https://i.imgur.com/RWjfjyv.png',
			color: embedColors.PlutoBlue, // Placeholder color, replace with actual one from your configuration
			footer: helpfooter,
		}
	}

	static helpInfo() {
		return {
			title: `How to use Pluto :coin:`,
			description: `Pluto provides the fun of placing wagers on sports games, featuring leaderboards and statistics to compete against others.\n# Getting Started\nTo get started, first run the slash command \`/odds\` and view the current odds available. You can immediately start placing bets with the \`/bet\` command. You'll start with a balance of $50 to bet with.\nUse the command \`/dailyclaim\` every 24 hours to receive free money into your account - this is useful if you ran out of money. Don't give up!\n# Process\nOnce a game ends, the bets placed on it will be processed.\nYou'll receive a DM from Pluto with your winnings and relevant bet result information.\nUse /commands to view all commands available\n***💜 Want to support the development of Pluto? Use the /about command***`,
			thumbnail: `https://i.imgur.com/RWjfjyv.png`,
			color: embedColors.PlutoBlue,
			footer: helpfooter,
		}
	}

	static faqInfo() {
		return {
			title: `❓ FAQ`,
			description: `# **__Leveling__**\nExperience *(XP)* is distributed when bets are closed.\n- A winning bet is worth 50 XP\n- A losing bet is 20.\nLevels are incorporated into the system to establish a structured progression system that goes beyond mere financial gains.\nThis system not only provides a clear measure of who the top performers are but also facilitates rewarding *(prizes, giveaway entries, etc)* the top betters at the end of each season.\nEveryone starts at level 0, and the max level is 100.\n## **__Tiers__**\nTiers are ranks that you receive as you level up.\nHere is the list of tiers and their level ranges:\nBronze: 0-15\nSilver: 15-30\nGold: 30-50\nEmerald: 50-75\nDiamond: 75-100\n# **__Parlays__**\n*TBD*\n💙 [Support the continued development of Pluto by making a donation](https://ko-fi.com/fenix7559)`,
			color: embedColors.PlutoBlue,
			thumbnail: `https://i.imgur.com/RWjfjyv.png`,
			footer: helpfooter,
		}
	}
}
