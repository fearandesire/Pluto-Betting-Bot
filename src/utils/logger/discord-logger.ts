import { container } from '@sapphire/framework'
import {
	type ColorResolvable,
	EmbedBuilder,
	type TextChannel,
} from 'discord.js'
import GuildWrapper from '../api/Khronos/guild/guild-wrapper.js'

interface EmbedLogOptions {
	guildId: string
	description: string
	title?: string
	footer?: string
}

/**
 * DexterLogger — sends structured embeds to a guild's configured log channel.
 *
 * All severity methods (error, warn, info, success) delegate to the single
 * `log()` entry point. On failure `container.logger.error` is the canonical
 * sink; no parallel `console.error` calls are present alongside it.
 */
export class DexterLogger {
	// -------------------------------------------------------------------------
	// Core send method
	// -------------------------------------------------------------------------

	/**
	 * Send an embed to the guild's configured log channel.
	 *
	 * @param options - Embed content and target guild.
	 * @param color   - Embed colour. Defaults to Discord blurple `#7289DA` — a
	 *   neutral tone for generic log messages. Severity helpers (error, warn,
	 *   info, success) pass an appropriate colour automatically; callers using
	 *   `.log()` directly rarely need to override this.
	 */
	async log(
		options: EmbedLogOptions,
		color: ColorResolvable = '#7289DA',
	): Promise<void> {
		const { guildId, description, title, footer } = options

		let logChannel: TextChannel | null = null
		try {
			logChannel = await new GuildWrapper().getLogChannel(guildId)
		} catch {
			logChannel = null
		}

		if (!logChannel) {
			// Single canonical sink — no console.error alongside container.logger.
			container.logger.error('DexterLogger: log channel unavailable', {
				guildId,
			})
			return
		}

		const embed = new EmbedBuilder()
			.setDescription(description)
			.setColor(color)
			.setTimestamp()

		if (title) embed.setTitle(title)
		if (footer) embed.setFooter({ text: footer })

		try {
			await logChannel.send({ embeds: [embed] })
		} catch (error) {
			// Single canonical sink — no console.error alongside container.logger.
			container.logger.error('DexterLogger: failed to send embed', {
				guildId,
				error,
			})
		}
	}

	// -------------------------------------------------------------------------
	// Severity helpers — call log() with a preset colour
	// -------------------------------------------------------------------------

	async error(options: EmbedLogOptions): Promise<void> {
		return this.log(options, '#FF0000')
	}

	async warn(options: EmbedLogOptions): Promise<void> {
		return this.log(options, '#f29831')
	}

	async info(options: EmbedLogOptions): Promise<void> {
		return this.log(options, '#3498db')
	}

	async success(options: EmbedLogOptions): Promise<void> {
		return this.log(options, '#57f287')
	}
}

export const dexterLogger = new DexterLogger()
