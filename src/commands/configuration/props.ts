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
	type PropsAutopostState,
	type PropsSettingState,
	propsDisabledPayload,
	propsEnabledPayload,
	propsErrorPayload,
	propsMissingPermissionsPayload,
	propsStatusPayload,
	propsStrategyPayload,
} from '../../lib/discord/builders/props-settings.js'
import GuildConfigWrapper, {
	PROPS_ENABLED_SETTING,
} from '../../utils/api/Khronos/guild/guild-config.wrapper.js'
import GuildWrapper from '../../utils/api/Khronos/guild/guild-wrapper.js'
import PropSettingsWrapper, {
	PROP_STRATEGIES,
	PropSettingsError,
	type PropStrategy,
} from '../../utils/api/Khronos/props/prop-settings-wrapper.js'

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

/**
 * Setup writes for one guild run one request at a time. An enable that pauses
 * between its channel save and its final PROPS_ENABLED write must not resume
 * after a later enable or disable, or it would undo that request's outcome.
 */
const guildWriteQueues = new Map<string, Promise<void>>()

function withGuildWriteLock<T>(
	guildId: string,
	task: () => Promise<T>,
): Promise<T> {
	const previous = guildWriteQueues.get(guildId) ?? Promise.resolve()
	const result = previous.then(task)
	const tail = result.then(
		() => undefined,
		() => undefined,
	)
	guildWriteQueues.set(guildId, tail)
	void tail.then(() => {
		if (guildWriteQueues.get(guildId) === tail) {
			guildWriteQueues.delete(guildId)
		}
	})
	return result
}

function strategyFailureCopy(error: unknown): string {
	const reason = error instanceof PropSettingsError ? error.reason : null
	if (reason === 'rejected') {
		return 'That strategy is not available for this server yet. Nothing was changed.'
	}
	if (reason === 'forbidden') {
		return 'Pluto is not allowed to change props settings right now. Nothing was changed.'
	}
	if (reason === 'unconfirmed') {
		return 'Pluto could not confirm the strategy was saved. Run /props status to see which strategy is active before trying again.'
	}
	return 'Pluto could not save the strategy. Nothing was changed, so please try again.'
}

@ApplyOptions<Subcommand.Options>({
	name: 'props',
	description: 'Turn daily player props on or off for this server',
	subcommands: [
		{ name: 'enable', chatInputRun: 'handleEnable' },
		{ name: 'disable', chatInputRun: 'handleDisable' },
		{ name: 'status', chatInputRun: 'handleStatus' },
		{ name: 'strategy', chatInputRun: 'handleStrategy' },
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
					)
					.addSubcommand((subcommand) =>
						subcommand
							.setName('strategy')
							.setDescription('Choose how daily props are picked')
							.addStringOption((option) =>
								option
									.setName('strategy')
									.setDescription('How props are picked')
									.addChoices(
										...PROP_STRATEGIES.map((value) => ({
											name: value,
											value,
										})),
									)
									.setRequired(true),
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

		const guildId = interaction.guildId
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
		// Holding the guild lock for all three writes stops this setup from
		// resuming after a later enable or disable and undoing it.
		try {
			await withGuildWriteLock(guildId, async () => {
				const guildConfig = new GuildConfigWrapper()
				await guildConfig.setPropsEnabled(guildId, false)
				await guildConfig.setPredictionsChannel(guildId, channel.id)
				await guildConfig.setPropsEnabled(guildId, true)
			})
		} catch (error) {
			return this.replyWithError(
				interaction,
				error,
				'Pluto could not finish setup. Run /props status, then try enabling again.',
			)
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
			await withGuildWriteLock(guildId, () =>
				new GuildConfigWrapper().setPropsEnabled(guildId, false),
			)
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
		const autopost = await this.loadAutopostState(guildId)
		return interaction.editReply(propsStatusPayload(state, autopost))
	}

	public async handleStrategy(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral })
		const guildId = interaction.guildId
		if (!guildId) {
			return interaction.editReply(
				propsErrorPayload('This command only works in a server.'),
			)
		}

		const strategy = interaction.options.getString(
			'strategy',
			true,
		) as PropStrategy
		try {
			await new PropSettingsWrapper().setStrategy(guildId, strategy)
		} catch (error) {
			this.container.logger.error(error)
			return interaction.editReply(
				propsErrorPayload(strategyFailureCopy(error)),
			)
		}
		return interaction.editReply(propsStrategyPayload(strategy))
	}

	/** A server with no settings row follows the default strategy and schedule. */
	private async loadAutopostState(
		guildId: string,
	): Promise<PropsAutopostState> {
		try {
			const row = await new PropSettingsWrapper().get(guildId)
			if (!row) return { kind: 'default' }
			return {
				kind: 'row',
				strategy: row.strategy,
				enabled: row.enabled,
				postTime: row.post_time,
			}
		} catch (error) {
			this.container.logger.warn(error)
			return { kind: 'unavailable' }
		}
	}

	private replyWithError(
		interaction: Subcommand.ChatInputCommandInteraction,
		error: unknown,
		summary = 'Pluto could not reach the props settings. Please try again.',
	) {
		this.container.logger.error(error)
		const detail =
			error instanceof Error && error.message
				? error.message
				: 'Unknown error'
		return interaction.editReply(propsErrorPayload(summary, detail))
	}
}
