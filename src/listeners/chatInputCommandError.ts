import {
	type ChatInputCommandErrorPayload,
	Events,
	Listener,
} from '@sapphire/framework'
import { EmbedBuilder, MessageFlags } from 'discord.js'
import embedColors from '../lib/colorsConfig.js'
import GuildWrapper from '../utils/api/Khronos/guild/guild-wrapper.js'
import { createLogger } from '../utils/logging/WinstonLogger.js'

/** Command categories whose errors are routed to the guild log channel. */
const PRIVILEGED_CATEGORIES = new Set(['admin', 'dev', 'staff'])

const log = createLogger({
	component: 'event',
	handler: 'chatInputCommandError',
})

export class ChatInputCommandError extends Listener<
	typeof Events.ChatInputCommandError
> {
	public override async run(
		err: unknown,
		{ command, duration, interaction }: ChatInputCommandErrorPayload,
	) {
		const subcommandGroup = this.getSubcommandGroup(interaction)
		const subcommand = this.getSubcommand(interaction)

		// Always log to Winston — full fidelity, every command.
		log.error('Chat input command failed', {
			event: 'command.error',
			commandType: 'chatInput',
			command: command.name,
			subcommandGroup,
			subcommand,
			durationMs: Math.round(duration),
			userId: interaction.user.id,
			userTag: interaction.user.tag,
			guildId: interaction.guildId,
			channelId: interaction.channelId,
			err,
		})

		// For privileged (admin / dev) commands, also post a sanitized report
		// to the guild's configured log channel so staff can triage without
		// digging through console output.
		const category = command.category ?? ''
		if (
			PRIVILEGED_CATEGORIES.has(category) &&
			interaction.guildId != null
		) {
			void this.postToLogChannel(err, {
				guildId: interaction.guildId,
				commandName: command.name,
				subcommandGroup,
				subcommand,
				userId: interaction.user.id,
				durationMs: Math.round(duration),
			})
		}

		// Respond to the interaction so the user is never left hanging.
		await this.replyWithErrorEmbed(interaction, command.name)
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	/**
	 * Sends a structured error report embed to the guild's log channel.
	 * Sanitizes the stack trace to at most 3 lines so the message stays readable.
	 * Failures here are swallowed — we must not throw from an error handler.
	 */
	private async postToLogChannel(
		err: unknown,
		meta: {
			guildId: string
			commandName: string
			subcommandGroup: string | null
			subcommand: string | null
			userId: string
			durationMs: number
		},
	): Promise<void> {
		try {
			const {
				guildId,
				commandName,
				subcommandGroup,
				subcommand,
				userId,
				durationMs,
			} = meta

			const error = err instanceof Error ? err : new Error(String(err))

			// Build a human-readable command path: /admin predictions view
			const pathParts = [commandName, subcommandGroup, subcommand].filter(
				Boolean,
			)
			const commandPath = `/${pathParts.join(' ')}`

			// Truncate the stack to 3 lines, strip the cwd prefix so paths are short.
			const cwd = process.cwd().replace(/\\/g, '/')
			const rawStack = (error.stack ?? error.message)
				.split('\n')
				.slice(0, 4) // message line + 3 "at …" lines
				.map((line) => line.replace(cwd, '').trim())
				.join('\n')

			const stackBlock = `\`\`\`\n${rawStack}\n\`\`\``

			const embed = new EmbedBuilder()
				.setColor(embedColors.error as `#${string}`)
				.setTitle('Command Error')
				.addFields(
					{ name: 'Command', value: commandPath, inline: true },
					{ name: 'User', value: `<@${userId}>`, inline: true },
					{
						name: 'Duration',
						value: `${durationMs}ms`,
						inline: true,
					},
					{
						name: 'Error',
						value: `\`${error.name}: ${error.message.slice(0, 200)}\``,
					},
					{ name: 'Stack', value: stackBlock },
				)
				.setTimestamp()

			await new GuildWrapper().sendToLogChannel(guildId, {
				embeds: [embed],
			})
		} catch (logErr) {
			// Best-effort — log channel may not be configured for this guild.
			log.warn('Failed to post command error to log channel', {
				event: 'command.error_log_channel_failed',
				guildId: meta.guildId,
				err: logErr,
			})
		}
	}

	/**
	 * Replies to (or follows up on) the interaction with a clean error embed.
	 * Handles deferred, already-replied, and fresh interaction states.
	 */
	private async replyWithErrorEmbed(
		interaction: ChatInputCommandErrorPayload['interaction'],
		commandName: string,
	): Promise<void> {
		const embed = new EmbedBuilder()
			.setColor(embedColors.error as `#${string}`)
			.setTitle('Something went wrong')
			.setDescription(
				'An unexpected error occurred while running this command. The issue has been logged and will be looked into.',
			)

		const payload = {
			embeds: [embed],
			flags: MessageFlags.Ephemeral as
				| MessageFlags.Ephemeral
				| MessageFlags.SuppressEmbeds
				| MessageFlags.SuppressNotifications
				| MessageFlags.IsComponentsV2,
		}

		try {
			if (interaction.deferred) {
				await interaction.editReply({ embeds: [embed] })
				return
			}

			if (interaction.replied) {
				await interaction.followUp(payload)
				return
			}

			await interaction.reply(payload)
		} catch (replyErr) {
			log.error('Failed to send error embed to interaction', {
				event: 'command.error_response_failed',
				commandType: 'chatInput',
				command: commandName,
				guildId: interaction.guildId,
				channelId: interaction.channelId,
				userId: interaction.user.id,
				err: replyErr,
			})
		}
	}

	private getSubcommandGroup(
		interaction: ChatInputCommandErrorPayload['interaction'],
	): string | null {
		try {
			return interaction.options.getSubcommandGroup(false)
		} catch {
			return null
		}
	}

	private getSubcommand(
		interaction: ChatInputCommandErrorPayload['interaction'],
	): string | null {
		try {
			return interaction.options.getSubcommand(false)
		} catch {
			return null
		}
	}
}
