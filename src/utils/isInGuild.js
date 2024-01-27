/**
 * @module isInGuild
 * Check if the user is using a command from a server or not. Used to prevent certain commands from being used in DMs.
 */
export default async function isInGuild(interaction) {
	if (!interaction.guildId) {
		throw interaction.reply({
			content: `This command can only be used in a server.`,
			ephemeral: true,
		})
	}
	return true
}
