import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import {
	InteractionContextType,
	PermissionFlagsBits,
	type SlashCommandStringOption,
} from 'discord.js'
import RecapWrapper from '../../utils/api/Khronos/recap/recap-wrapper.js'
import {
	explicitChannelResolver,
	RECAP_POST_SPORTS,
	RECAP_POST_TYPES,
	RecapPostService,
	type RecapPostType,
} from '../../utils/recap/recap-post-service.js'

function addChoices(
	option: SlashCommandStringOption,
	values: readonly string[],
) {
	return option.addChoices(
		...values.map((value) => ({ name: value.toUpperCase(), value })),
	)
}

/**
 * Staff recovery/manual path for the weekly and monthly recaps. Scheduled
 * posts stay owned by the cron services; this command only triggers one now.
 */
@ApplyOptions<Subcommand.Options>({
	name: 'recap',
	description: 'Post a guild recap now',
	requiredClientPermissions: [
		PermissionFlagsBits.SendMessages,
		PermissionFlagsBits.EmbedLinks,
	],
	subcommands: [{ name: 'post', chatInputRun: 'handlePost' }],
})
export class UserCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder
				.setName(this.name)
				.setDescription(this.description)
				.setContexts(InteractionContextType.Guild)
				.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
				.addSubcommand((subcommand) =>
					subcommand
						.setName('post')
						.setDescription('Post a recap to this guild now')
						.addStringOption((option) =>
							addChoices(
								option
									.setName('type')
									.setDescription('Recap to post')
									.setRequired(true),
								RECAP_POST_TYPES,
							),
						)
						.addStringOption((option) =>
							addChoices(
								option
									.setName('sport')
									.setDescription(
										'Sport to include (default: nfl)',
									)
									.setRequired(false),
								RECAP_POST_SPORTS,
							),
						),
				),
		)
	}

	public async handlePost(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		const guildId = interaction.guildId
		if (!guildId) {
			return interaction.editReply({
				content: 'This command can only be used in a guild.',
			})
		}

		const type = interaction.options.getString('type') as RecapPostType
		const sport =
			(interaction.options.getString('sport') as
				| (typeof RECAP_POST_SPORTS)[number]
				| null) ?? 'nfl'

		try {
			const recapApi = new RecapWrapper()
			const channelId = await this.resolveChannel(
				recapApi,
				guildId,
				interaction.channelId,
			)
			const result = await new RecapPostService(
				recapApi,
				explicitChannelResolver,
			).post({ guildId, channelId, type, sport })
			return interaction.editReply({
				content: `Posted the ${type} ${sport.toUpperCase()} recap in <#${result.channel_id}>.`,
			})
		} catch (error) {
			this.container.logger.error(error)
			return interaction.editReply({
				content:
					error instanceof Error
						? error.message
						: 'Could not post the recap.',
			})
		}
	}

	/** Prefer the saved guild channel, then the channel the command ran in. */
	private async resolveChannel(
		recapApi: RecapWrapper,
		guildId: string,
		fallbackChannelId: string | null,
	): Promise<string> {
		try {
			const settings = await recapApi.getSettings()
			const row = settings.find(
				(candidate) => candidate.guild_id === guildId,
			)
			if (row?.channel_id) return row.channel_id
		} catch (error) {
			this.container.logger.warn(
				`Could not load recap settings for ${guildId}: ${
					error instanceof Error ? error.message : String(error)
				}`,
			)
		}
		const fallback = (fallbackChannelId ?? '').trim()
		if (!fallback) {
			throw new Error('No recap channel is configured for this guild')
		}
		return fallback
	}
}
