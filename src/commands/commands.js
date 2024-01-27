import { Command } from '@sapphire/framework'
import discord from 'discord.js'
import _ from 'lodash'
import embedColors from '../lib/colorsConfig.js'

const { EmbedBuilder } = discord
export class commands extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'commands',
			description:
				'💡 View all commands available to you.',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('commands')
					.setDescription(this.description),
			//	{ idHints: [``] },
		)
	}

	async chatInputRun(interaction) {
		const cmdList = {
			betting: {
				odds: "View the odds for this week's matchups",
				bet: 'Place a bet on a matchup',
				cancelbet:
					"Cancel a pending bet you've placed",
				changebet:
					"Change the amount you've bet on a matchup, without cancelling it",
				balance: 'View your current balance',
				givemoney: 'Give money to another user',
			},
			info: {
				stats: 'View your betting stats',
				leaderboard:
					"View the betting leaderboard, see who's on top and where you stand!",
				help: 'View information on how to use the bot',
				commands:
					'View all commands available to you',
				bethistory:
					'View the track record of your bets',
			},
		}

		const formatCommands = (cmds) => {
			let formattedCommands = ''
			for (const [key, value] of Object.entries(
				cmds,
			)) {
				formattedCommands += `⭐ **__${_.upperFirst(
					key,
				)}__**\n`
				for (const [
					command,
					description,
				] of Object.entries(value)) {
					formattedCommands += `**\`/${command}\`** - ${description}\n`
				}
				formattedCommands += '\n'
			}
			return formattedCommands
		}
		const cmdDescription = formatCommands(cmdList)
		const cmdListEmbed = new EmbedBuilder()
			.setTitle('Commands')
			.setColor(`${embedColors.PlutoYellow}`)
			.setDescription(cmdDescription)
			.setFooter({
				text: `Pluto | Developed by fenixforever`,
			})
			.setThumbnail(`https://i.imgur.com/RWjfjyv.png`)

		interaction.reply({
			embeds: [cmdListEmbed],
			ephemeral: true,
		})
	}
}
