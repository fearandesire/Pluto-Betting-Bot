import type { ChatInputCommandInteraction } from 'discord.js'
import { predictionDeprecationEmbed } from '../../lib/discord/builders/props.js'

/**
 * Keep legacy prediction commands discoverable while the consolidated command
 * rolls out. The aliases can be removed after one release cycle.
 */
export async function sendPredictionCommandDeprecation(
	interaction: ChatInputCommandInteraction,
	replacement: string,
) {
	await interaction.deferReply({ ephemeral: true })

	const embed = predictionDeprecationEmbed(replacement)

	return interaction.editReply({ embeds: [embed] })
}
