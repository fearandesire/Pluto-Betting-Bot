import {
	type DiscordConfig,
	DiscordConfigSettingTypeEnum,
} from '@pluto-khronos/api-client'
import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import {
	ChannelType,
	InteractionContextType,
	MessageFlags,
	PermissionFlagsBits,
	type PermissionsBitField,
} from 'discord.js'
import {
	type PropsSettingState,
	propsDisabledPayload,
	propsEnabledPayload,
	propsErrorPayload,
	propsMissingPermissionsPayload,
	propsStatusPayload,
} from '../../lib/discord/builders/props-settings.js'
import GuildConfigWrapper, {
	PROPS_ENABLED_SETTING,
} from '../../utils/api/Khronos/guild/guild-config.wrapper.js'
import GuildWrapper from '../../utils/api/Khronos/guild/guild-wrapper.js'

/**
 * Prop delivery (`GuildWrapper.sendToChannel`) only accepts guild text
 * channels, so the picker offers only those.
 */
const PROPS_CHANNEL_TYPES = [ChannelType.GuildText] as const

/** Posting needs the first three; settlement edits fetch the original message. */
const REQUIRED_BOT_PERMISSIONS = [
	['View Channel', PermissionFlagsBits.ViewChannel],
	['Send Messages', PermissionFlagsBits.SendMessages],
	['Embed Links', PermissionFlagsBits.EmbedLinks],
	['Read Message History', PermissionFlagsBits.ReadMessageHistory],
] as const

export function missingBotPermissions(
	permissions: Readonly<PermissionsBitField> | null,
): string[] {
	return REQUIRED_BOT_PERMISSIONS.filter(
		([, flag]) => !permissions?.has(flag),
	).map(([name]) => name)
}

/** A missing PROPS_ENABLED row means enabled; only `'false'` turns props off. */
export function resolvePropsSetting(
	config: DiscordConfig[] | undefined,
): PropsSettingState {
	const rows = new Map<string, string>(
		(config ?? []).map((row) => [row.setting_type, row.setting_value]),
	)
	const channelId = rows.get(DiscordConfigSettingTypeEnum.PredictionsChan)
	if (!channelId) return { kind: 'not_set_up' }
	return rows.get(PROPS_ENABLED_SETTING) === 'false'
		? { kind: 'disabled', channelId }
		: { kind: 'enabled', channelId }
}

@ApplyOptions<Subcommand.Options>({
	name: 'props',
	description: 'Turn daily player props on or off for this server',
	subcommands: [
		{ name: 'enable', chatInputRun: 'handleEnable' },
		{ name: 'disable', chatInputRun: 'handleDisable' },
		{ name: 'status', chatInputRun: 'handleStatus' },
	],
})
export class UserCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.setContexts(InteractionContextType.Guild)
					.setDefaultMemberPermissions(
						PermissionFlagsBits.Administrator,
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('enable')
							.setDescription(
								'Post daily player props in a channel',
							)
							.addChannelOption((option) =>
								option
									.setName('channel')
									.setDescription(
										'The channel to post daily props in',
									)
									.addChannelTypes(...PROPS_CHANNEL_TYPES)
									.setRequired(true),
							),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('disable')
							.setDescription('Stop posting daily player props'),
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('status')
							.setDescription(
								'Show whether daily props are on and where they post',
							),
					),
			{ idHints: [] },
		)
	}

	public async handleEnable(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral })
		if (!interaction.inCachedGuild()) {
			return interaction.editReply(
				propsErrorPayload('Pluto must be a member of this server.'),
			)
		}

		const channel = interaction.options.getChannel('channel', true, [
			...PROPS_CHANNEL_TYPES,
		])
		const me =
			interaction.guild.members.me ??
			(await interaction.guild.members.fetchMe())
		const missing = missingBotPermissions(channel.permissionsFor(me))
		if (missing.length > 0) {
			return interaction.editReply(
				propsMissingPermissionsPayload(channel.id, missing),
			)
		}

		// Keep posting disabled until the channel write succeeds. Re-enabling
		// first could reactivate an old channel if saving the new one fails.
		try {
			const guildConfig = new GuildConfigWrapper()
			await guildConfig.setPropsEnabled(interaction.guildId, false)
			await guildConfig.setPredictionsChannel(
				interaction.guildId,
				channel.id,
			)
			await guildConfig.setPropsEnabled(interaction.guildId, true)
		} catch (error) {
			return this.replyWithError(interaction, error)
		}
		return interaction.editReply(propsEnabledPayload(channel.id))
	}

	public async handleDisable(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral })
		const guildId = interaction.guildId
		if (!guildId) {
			return interaction.editReply(
				propsErrorPayload('This command only works in a server.'),
			)
		}

		try {
			await new GuildConfigWrapper().setPropsEnabled(guildId, false)
		} catch (error) {
			return this.replyWithError(interaction, error)
		}
		return interaction.editReply(propsDisabledPayload())
	}

	public async handleStatus(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral })
		const guildId = interaction.guildId
		if (!guildId) {
			return interaction.editReply(
				propsErrorPayload('This command only works in a server.'),
			)
		}

		let state: PropsSettingState
		try {
			const guild = await new GuildWrapper().getGuild(guildId)
			state = resolvePropsSetting(guild.config)
		} catch (error) {
			return this.replyWithError(interaction, error)
		}
		return interaction.editReply(propsStatusPayload(state))
	}

	private replyWithError(
		interaction: Subcommand.ChatInputCommandInteraction,
		error: unknown,
	) {
		this.container.logger.error(error)
		const detail =
			error instanceof Error && error.message
				? error.message
				: 'Unknown error'
		return interaction.editReply(
			propsErrorPayload(
				'Pluto could not reach the props settings. Please try again.',
				detail,
			),
		)
	}
}
