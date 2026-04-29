import {
	type ChatInputCommandErrorPayload,
	Events,
	Listener,
} from '@sapphire/framework'
import { MessageFlags } from 'discord.js'
import { createLogger } from '../utils/logging/WinstonLogger.js'

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
		log.error('Chat input command failed', {
			event: 'command.error',
			commandType: 'chatInput',
			command: command.name,
			subcommandGroup: this.getSubcommandGroup(interaction),
			subcommand: this.getSubcommand(interaction),
			durationMs: Math.round(duration),
			userId: interaction.user.id,
			userTag: interaction.user.tag,
			guildId: interaction.guildId,
			channelId: interaction.channelId,
			err,
		})

		try {
			const content =
				'That command hit an internal error. I logged the details to the console.'

			if (interaction.deferred) {
				await interaction.editReply({ content })
				return
			}

			if (interaction.replied) {
				await interaction.followUp({
					content,
					flags: MessageFlags.Ephemeral,
				})
				return
			}

			await interaction.reply({
				content,
				flags: MessageFlags.Ephemeral,
			})
		} catch (replyErr) {
			log.error('Failed to send chat input command error response', {
				event: 'command.error_response_failed',
				commandType: 'chatInput',
				command: command.name,
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
