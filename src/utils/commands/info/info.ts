import { helpfooter } from '@pluto-config'
import embedColors from '../../../lib/colorsConfig.js'
import { plutoDocsUrl } from '../../../lib/configs/constants.js'
import { patreonUrl } from '../../../utils/api/patreon/interfaces.js'
import { APP_VERSION } from '../../../utils/scripts/pkg-version.js'

export default class PlutoInfo {
	static async commandsInfo() {
		const cmdList = {
			betting: {
				odds: "View the odds for this week's matches",
				bet: 'Place a bet on a match',
				cancelbet: "Cancel a pending bet you've placed",
				balance: 'View your current balance',
				dailyclaim:
					'Claim $50 every day, or twice a day for Patreon members.',
				mybets: 'View your active placed bets',
				doubledown:
					'Double an existing bet, use it on a confident bet!',
			},
			info: {
				stats: 'View your betting stats',
				leaderboard:
					"View the betting leaderboard, see who's on top and where you stand!",
				help: 'View information on how to use the bot',
				commands: 'View all commands',
				bethistory: 'View the track record of your bets',
			},
		}
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
			// Add link to the website
			formattedCommands += `**📒 [Docs](${plutoDocsUrl})**\n`
			return formattedCommands
		}

		// Construct the embed description with formatted commands and maintenance note
		const cmdDescription = `${formatCommands(cmdList)}*Currently, the following commands are under maintenance:\n- \`bethistory\`\n- \`stats\`*`

		return {
			title: 'Pluto Commands',
			description: cmdDescription,
			thumbnail: 'https://i.imgur.com/RWjfjyv.png',
			color: embedColors.PlutoBlue, // Placeholder color, replace with actual one from your configuration
			footer: await helpfooter('core'),
		}
	}

	static async helpInfo() {
		return {
			title: 'Pluto Documentation',
			description: `Pluto is a full-fledged betting app that creates a competitive sports betting environment.\n# Getting Started\n1. Run the \`/odds\` command to view current betting odds.\n2. Use the \`/bet\` command to place bets, starting with a balance of $50.\n3. Use the \`/dailyclaim\` command every 24 hours to get free money if you run out of funds.\n\n**💜 [Support Pluto](https://www.patreon.com/fenix_)**\n**📒 [Documentation](${plutoDocsUrl})**\n\nVersion: \`${APP_VERSION}\``,
			thumbnail: 'https://i.imgur.com/RWjfjyv.png',
			color: embedColors.PlutoBlue,
			footer: await helpfooter('core'),
		}
	}

	static async faqInfo() {
		return {
			title: '❓ FAQ',
			description: `# **__Leveling__**\nExperience *(XP)* is distributed when bets are closed.\n- A winning bet is worth 50 XP\n- A losing bet is 20.\nLevels are incorporated into the system to establish a structured progression system that goes beyond mere financial gains.\nThis system not only provides a clear measure of who the top performers are but also facilitates rewarding *(prizes, giveaway entries, etc)* the top betters at the end of each season.\nEveryone starts at level 0, and the max level is 100.\n## **__Tiers__**\nTiers are ranks that you receive as you level up.\nHere is the list of tiers and their level ranges:\nBronze: 0-15\nSilver: 15-30\nGold: 30-50\nEmerald: 50-75\nDiamond: 75-100\n# **__Parlays__**\n*TBD*\n💙 [Support the continued development of Pluto](${patreonUrl})`,
			color: embedColors.PlutoBlue,
			thumbnail: 'https://i.imgur.com/RWjfjyv.png',
			footer: await helpfooter('core'),
		}
	}
}
