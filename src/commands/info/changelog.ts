import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { APP_OWNER_INFO } from '#lib/configs/constants.js'
import { changelogEmbed } from '../../lib/discord/builders/changelog.js'
import { ApiModules } from '../../lib/interfaces/api/api.interface.js'
import { ChangelogWrapper } from '../../utils/api/Khronos/changelog/changelog-wrapper.js'
import { ApiErrorHandler } from '../../utils/api/Khronos/error-handling/ApiErrorHandler.js'

@ApplyOptions<Command.Options>({
	name: 'changelog',
	description: '📝 View the latest Pluto update',
})
export class UserCommand extends Command {
	private readonly changelogWrapper = new ChangelogWrapper()

	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder.setName(this.name).setDescription(this.description),
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		try {
			const changelog =
				await this.changelogWrapper.getLatestPlutoChangelog()

			if (!changelog) {
				return interaction.editReply({
					content: 'No updates have been published yet.',
				})
			}

			const embed = changelogEmbed(changelog, APP_OWNER_INFO.discord_id)

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
