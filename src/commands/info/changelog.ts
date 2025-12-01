import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { EmbedBuilder } from 'discord.js'
import embedColors from '../../lib/colorsConfig.js'
import { ApiModules } from '../../lib/interfaces/api/api.interface.js'
import { ApiErrorHandler } from '../../utils/api/Khronos/error-handling/ApiErrorHandler.js'
import { ChangelogWrapper } from '../../utils/api/Khronos/changelog/changelog-wrapper.js'
import { APP_OWNER_INFO } from '#lib/configs/constants.js'

@ApplyOptions<Command.Options>({
	description: '📝 View the latest Pluto update',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder.setName(this.name).setDescription(this.description),
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		const wrapper = new ChangelogWrapper()

		try {
			const changelog = await wrapper.getLatestPlutoChangelog()

			if (!changelog) {
				return interaction.editReply({
					content: 'No updates have been published yet.',
				})
			}

			const publishedTimestamp = Math.floor(
				new Date(changelog.published_at).getTime() / 1000,
			)

			// Process content to ensure escaped newlines become actual newlines
			const processedContent = changelog.content.replace(/\\n/g, '\n')
			// Title may contain markdown headers, so don't wrap in bold if it starts with #
			const processedTitle = changelog.title.startsWith('#')
				? changelog.title.replace(/\\n/g, '\n')
				: `**${changelog.title.replace(/\\n/g, '\n')}**`

			const embed = new EmbedBuilder()
				.setTitle(`Pluto Update v${changelog.version}`)
				.setDescription(`${processedTitle}\n\n${processedContent}\n\nMade by <@${APP_OWNER_INFO.discord_username}>`)
				.setColor(embedColors.PlutoBlue)
				.addFields({
					name: '📅 Published',
					value: `<t:${publishedTimestamp}:R>`,
					inline: true,
				})
				.addFields({
					name: 'Docs',
					value: 'https://docs.pluto.fearandesire.com'
				})
				.setFooter({ text: 'Use `/help for more information on Pluto' })
				.setTimestamp(new Date(changelog.created_at))

			return interaction.editReply({ embeds: [embed] })
		} catch (error) {
			return await new ApiErrorHandler().handle(
				interaction,
				error,
				ApiModules.unknown,
			)
		}
	}
}
