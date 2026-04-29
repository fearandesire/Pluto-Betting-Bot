import {
	type ChatInputCommandSuccessPayload,
	Events,
	Listener,
} from '@sapphire/framework'
import type { ChatInputCommandInteraction } from 'discord.js'
import { createLogger } from '../utils/logging/WinstonLogger.js'

/**
 * Logs every successful chat input command run.
 *
 * Mirrors the listener-based command logger from the official Sapphire
 * TypeScript template, but routes through our structured Winston logger
 * so each event is both pretty in the dev console and queryable in
 * Loki/Grafana.
 *
 * Pairs with `chatInputCommandError.ts` (failure path) and
 * `chatInputCommandDenied.ts` (precondition denials) to make the
 * chat-input lifecycle fully observable.
 */
const log = createLogger({
	component: 'event',
	handler: 'chatInputCommandSuccess',
})

export class ChatInputCommandSuccess extends Listener<
	typeof Events.ChatInputCommandSuccess
> {
	public override run(payload: ChatInputCommandSuccessPayload) {
		const { command, duration, interaction } = payload

		const subcommandGroup = this.getSubcommandGroup(interaction)
		const subcommand = this.getSubcommand(interaction)

		const commandPath = [command.name, subcommandGroup, subcommand]
			.filter((part): part is string => Boolean(part))
			.join(' ')

		log.info('Chat input command completed', {
			event: 'command.success',
			commandType: 'chatInput',
			command: command.name,
			commandPath,
			subcommandGroup,
			subcommand,
			invocation: interaction.toString(),
			durationMs: Math.round(duration),
			userId: interaction.user.id,
			userTag: interaction.user.tag,
			guildId: interaction.guildId,
			guildName: interaction.guild?.name ?? null,
			channelId: interaction.channelId,
			channelName: this.getChannelName(interaction),
			options: this.collectOptions(interaction),
		})
	}

	private getSubcommandGroup(
		interaction: ChatInputCommandInteraction,
	): string | null {
		try {
			return interaction.options.getSubcommandGroup(false)
		} catch {
			return null
		}
	}

	private getSubcommand(
		interaction: ChatInputCommandInteraction,
	): string | null {
		try {
			return interaction.options.getSubcommand(false)
		} catch {
			return null
		}
	}

	private getChannelName(
		interaction: ChatInputCommandInteraction,
	): string | null {
		const channel = interaction.channel
		if (!channel) return null
		if ('name' in channel && channel.name) return channel.name
		return null
	}

	/**
	 * Flattens the user-supplied options into a `{ name: value }` map for
	 * Loki querying. Resolved options (users, channels, roles) are reduced
	 * to their snowflake IDs so the log payload stays compact and queryable.
	 */
	private collectOptions(
		interaction: ChatInputCommandInteraction,
	): Record<string, unknown> {
		const result: Record<string, unknown> = {}

		for (const option of interaction.options.data) {
			if (option.options) {
				for (const sub of option.options) {
					if (sub.options) {
						for (const inner of sub.options) {
							result[inner.name] = this.serializeOption(inner)
						}
					} else {
						result[sub.name] = this.serializeOption(sub)
					}
				}
			} else {
				result[option.name] = this.serializeOption(option)
			}
		}

		return result
	}

	private serializeOption(
		option: ChatInputCommandInteraction['options']['data'][number],
	): unknown {
		if (option.user) return option.user.id
		if (option.channel) return option.channel.id
		if (option.role) return option.role.id
		if (option.attachment) return option.attachment.id
		return option.value ?? null
	}
}
