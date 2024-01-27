import { Command } from '@sapphire/framework'
import discord from 'discord.js'
import embedColors from '../lib/colorsConfig.js'

const { EmbedBuilder } = discord
export class help extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'help',
			aliases: [''],
			description: '❓ Learn how to use Pluto',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName('help')
				.setDescription(this.description)
				.setDMPermission(false),
		)
	}

	async chatInputRun(interaction) {
		const desc = `Pluto provides the fun of placing wagers on sports games, featuring leaderboards and statistics to compete against others.

               **Getting Started**
                
                To get started, first run the slash command **/register** to create your account. You'll start with $50 to bet with. From there, you have a few options.
                
                You can:
- View odds for the day with /odds
- Place bets with the /bet command.
- Use /dailyclaim every 24 hours to receive a bonus $$
                

**Process**
                Once a game ends, the bets placed on it will be processed.
                You'll receive a DM from Pluto with your winnings.
                
                Use /commands to view all commands available
                ***💜 Want to support the development of Pluto? Use the /about command***`
		const helpEmbed = new EmbedBuilder()
			.setTitle(`How to use Pluto :coin:`)
			.setColor(`${embedColors.PlutoYellow}`)
			.setDescription(desc)
			.setThumbnail(`https://i.imgur.com/RWjfjyv.png`)
			.setFooter({
				text: `Pluto | Created by FENIX#7559`,
			})
		return interaction.reply({
			embeds: [helpEmbed],
			ephemeral: true,
		})
	}
}
