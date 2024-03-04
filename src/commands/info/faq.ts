import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import embedColors from '../../lib/colorsConfig.js'
import { helpfooter } from '@pluto-core-config'
import { EmbedBuilder } from 'discord.js'

@ApplyOptions<Command.Options>({
	description: '❓ Frequently Asked Questions & XP System',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description),
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		const embObj = {
			title: `❓ FAQ`,
			description: `# **__Leveling__**\nExperience *(XP)* is distributed when bets are closed.\n- A winning bet is worth 50 XP\n- A losing bet is 20.\nLevels are incorporated into the system to establish a structured progression system that goes beyond mere financial gains.\nThis system not only provides a clear measure of who the top performers are but also facilitates rewarding *(prizes, giveaway entries, etc)* the top betters at the end of each season.\nEveryone starts at level 0, and the max level is 100.\n## **__Tiers__**\nTiers are ranks that you receive as you level up.\n	Here is the list of tiers and their level ranges:\nBronze: 0-15\n	Silver: 15-30\n	Gold: 30-50\n	Emerald: 50-75\n	Diamond: 75-100\n# **__Parlays__**\n	*TBD*\n💙 [Support the continued development of Pluto by making a donation](https://ko-fi.com/fenix7559)`,
			color: embedColors.PlutoBlue,
			footer: helpfooter,
		}
		const embed = new EmbedBuilder()
			.setTitle(embObj.title)
			.setDescription(embObj.description)
			.setColor(embObj.color)
			.setFooter({ text: embObj.footer })
		return interaction.reply({ embeds: [embed], ephemeral: true })
	}
}
