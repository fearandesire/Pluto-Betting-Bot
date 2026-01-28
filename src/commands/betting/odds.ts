import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { InteractionContextType } from 'discord.js'
import { ApiModules } from '../../lib/interfaces/api/api.interface.js'
import env from '../../lib/startup/env.js'
import { ApiErrorHandler } from '../../utils/api/Khronos/error-handling/ApiErrorHandler.js'
import GuildWrapper from '../../utils/api/Khronos/guild/guild-wrapper.js'
import MatchApiWrapper from '../../utils/api/Khronos/matches/matchApiWrapper.js'
import { ErrorEmbeds } from '../../utils/common/errors/global.js'
import { logger } from '../../utils/logging/WinstonLogger.js'
import { prepareAndFormat } from '../../utils/matches/OddsProcessing.js'

@ApplyOptions<Command.Options>({
	description: '🔎 View current matches & odds',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.setContexts(InteractionContextType.Guild)
				.addStringOption((option) =>
					option
						.setName('timezone')
						.setDescription(
							'The time zone displayed for the matches, in IANA format (e.g., America/New_York)',
						)
						.setRequired(false),
				),
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply()

		if (env.MAINTENANCE_MODE) {
			const errEmbed = await ErrorEmbeds.maintenanceMode()
			return interaction.editReply({ embeds: [errEmbed] })
		}

		const guildId = interaction.guild!.id
		const embedThumbnail = interaction.guild!.iconURL({ extension: 'jpg' })
		if (!embedThumbnail)
			return interaction.followUp({
				embeds: [
					await ErrorEmbeds.internalErr(
						'Unable to resolve Guild Icon.',
					),
				],
			})
		try {
			const guildConfig = await new GuildWrapper().getGuild(guildId)
			const sport = guildConfig.sport
			const matchupsForGuild =
				await new MatchApiWrapper().matchesForSport({
					sport: sport.toLowerCase(),
					guildId,
				})
			const { matches } = matchupsForGuild

			logger.debug('Odds command: matches retrieved', {
				guildId,
				sport,
				matchCount: matches?.length ?? 0,
			})

			const userTZInput = interaction.options
				.getString('timezone', false)
				?.trim()
			if (userTZInput) {
				try {
					new Date().toLocaleString('en-US', {
						timeZone: userTZInput,
					})
				} catch {
					return interaction.editReply({
						content:
							'Invalid timezone, please use an IANA format like America/New_York.',
					})
				}
			}
			let oddsEmbed
			try {
				oddsEmbed = await prepareAndFormat(
					matches,
					embedThumbnail,
					guildId,
					userTZInput,
				)
			} catch (formatError) {
				logger.debug('Odds command: error in prepareAndFormat', {
					guildId,
					sport,
					matchCount: matches?.length ?? 0,
					error: formatError,
				})
				throw formatError
			}

			if (!oddsEmbed) {
				logger.debug(
					'Odds command: prepareAndFormat returned null/undefined',
					{
						guildId,
						sport,
						matchCount: matches?.length ?? 0,
					},
				)
				const errEmb = await ErrorEmbeds.invalidRequest(
					'No Odds are currently posted.',
				)
				return interaction.followUp({
					embeds: [errEmb],
				})
			}
			return interaction.followUp({
				embeds: [oddsEmbed],
			})
		} catch (error) {
			logger.debug('Odds command: unhandled error', {
				guildId: interaction.guild?.id,
				error,
			})
			await new ApiErrorHandler().handle(
				interaction,
				error,
				ApiModules.unknown,
			)
		}
	}
}
