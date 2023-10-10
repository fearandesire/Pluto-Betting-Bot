import { Command } from '@sapphire/framework'
import { helpfooter, embedReply } from '#config'
import embedColors from '../lib/colorsConfig.js'

export class faq extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'faq',
			description:
				'Information on frequently asked questions',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('faq')
					.setDescription(this.description),
			// { idHints: [``] },
		)
	}

	async chatInputRun(interaction) {
		await interaction.deferReply({ ephemeral: true })
		const embObj = {
			title: `❓ FAQ`,
			description: `# **__Leveling__**
			Experience *(XP)* is distributed when bets are closed.
				- A winning bet is worth 50 XP
				 - A losing bet is 20.\n
				Levels are incorporated into the system to establish a structured progression system that goes beyond mere financial gains.
				This system not only provides a clear measure of who the top performers are but also facilitates rewarding *(prizes, giveaway entries, etc)* the top betters at the end of each season.
				Everyone starts at level 0, and the max level is 100.
				
			## **__Tiers__**
			Tiers are ranks that you receive as you level up.
			Here is the list of tiers and their level ranges:
		    Bronze: 0-15
			Silver: 15-30
			Gold: 30-50
			Emerald: 50-75
			Diamond: 75-100
			
			# **__Parlays__**
			*TBD*
			
			💙 [Support the continued development of Pluto by making a donation](https://ko-fi.com/fenix7559)`,
			color: embedColors.PlutoBlue,
			footer: helpfooter,
		}
		await embedReply(interaction, embObj)
	}
}
