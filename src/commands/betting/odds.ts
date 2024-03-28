import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { prepareAndFormat } from '../../utils/matches/OddsProcessing.js'
import GuildWrapper from '../../utils/api/Khronos/guild/guild-wrapper.js'
import MatchApiWrapper from '../../utils/api/Khronos/matches/matchApiWrapper.js'
import { ApiErrorHandler } from '../../utils/api/Khronos/error-handling/ApiErrorHandler.js'
import { ApiModules } from '../../lib/interfaces/api/api.interface.js'
import { ErrorEmbeds } from '../../utils/common/errors/global.js'

@ApplyOptions<Command.Options>({
	description: '🔎 View current matches & odds',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.setDMPermission(true),
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply()
		if (!interaction.guild) {
			const errEmb = ErrorEmbeds.invalidRequest(
				`This command can only be used in a server.`,
			)
			return interaction.editReply({ embeds: [errEmb] })
		}
		const guildId = interaction.guild.id
		const embedThumbnail = interaction.guild.iconURL({ extension: 'jpg' })
		if (!embedThumbnail)
			return interaction.editReply({
				embeds: [
					ErrorEmbeds.internalErr(`Unable to resolve Guild Icon.`),
				],
			})
		try {
			const guildConfig = await new GuildWrapper().getGuild(guildId)
			const sport = guildConfig.sport
			const matchupsForGuild =
				await new MatchApiWrapper().matchesForSport({
					sport: sport.toLowerCase(),
				})
			const { matches } = matchupsForGuild
			const oddsEmbed = await prepareAndFormat(matches, embedThumbnail)
			if (!oddsEmbed) {
				const errEmb = ErrorEmbeds.invalidRequest(
					`No Odds are currently posted.`,
				)
				return interaction.editReply({
					embeds: [errEmb],
				})
			}
		} catch (error) {
			await new ApiErrorHandler().handle(
				interaction,
				error,
				ApiModules.unknown,
			)
		}
	}
}
