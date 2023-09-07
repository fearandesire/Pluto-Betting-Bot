import { Command } from '@sapphire/framework'
import { MessageEmbed } from 'discord.js'

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
				.setDescription(this.description),
		)
	}

	async chatInputRun(interaction) {
		const desc = `:coin:  Pluto provides the fun of placing wagers on sports games, featuring leaderboards and statistics to compete against others.

               **Getting Started**
                
                To get started, first run the slash command **/register** to create your account. You'll start with $100 to bet with. From there, you have a few options.
                
                You can:
- View odds for the day with /odds
- Place bets with the /bet command.
- Use /dailyclaim every 24 hours to receive a bonus $100
                

**Process**
                Once a game ends, the bets placed on it will be processed.
                You'll receive a DM from Pluto with your winnings.
                
                Use /commands to view all commands available
                ***To learn more about Pluto or support development, use the /about command***`
		const helpEmbed = new MessageEmbed()
			.setTitle(`How to use Pluto`)
			.setColor('#ffff00')
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
