import { type ChatInputCommandInteraction, EmbedBuilder } from 'discord.js'
import embedColors from '../../lib/colorsConfig.js'

/**
 * Keep legacy prediction commands discoverable while the consolidated command
 * rolls out. The aliases can be removed after one release cycle.
 */
export async function sendPredictionCommandDeprecation(
	interaction: ChatInputCommandInteraction,
	replacement: string,
) {
	await interaction.deferReply({ ephemeral: true })

	const embed = new EmbedBuilder()
		.setColor(embedColors.info)
		.setTitle('Prediction command moved')
		.setDescription(
			`This command is kept for one release as an alias. Use **${replacement}** instead.`,
		)
		.setFooter({
			text: 'Legacy aliases will be removed after the migration window.',
		})

	return interaction.editReply({ embeds: [embed] })
}
