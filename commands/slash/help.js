import { Command } from '@sapphire/framework'
import { MessageEmbed } from "discord.js"

export class help extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'help',
			aliases: [''],
			description: 'Learn how to use Pluto',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('help')
					.setDescription(this.description)
		)
	}
	async chatInputRun(interaction) {
		const helpEmbed = new MessageEmbed()
			.setTitle(`How to use Pluto`)
			.setColor('#ffff00')
			.setDescription(`:green_circle: **First, run the command \`/register\` to create your account.** You will start with $100 :moneybag:\n\nView odds for the day with \`/odds\`\n\nPlace bets with the \`/bet\` command.\n\nIf you run out of money, use \`/dailyclaim\` every 24 hours to receive $100.\n\nOnce a game ends, the bets placed on it will be processed.\nYou'll receive a DM from Pluto with your winnings.\n\n\For all commands, check \`/commands\`\nTo learn more about Pluto, use the \`/about\` command\n\n*If you have any questions or concerns, please message **<@${process.env.botDevID}>***
			`)
			.setThumbnail(`https://i.imgur.com/RWjfjyv.png`)
			.setFooter({ text: `Pluto | Created by FENIX#7559` })
		return interaction.reply({ embeds: [helpEmbed], ephemeral: true })
	}
}
