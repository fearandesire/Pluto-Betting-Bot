import { container } from '@sapphire/framework'
import type { TextChannel } from 'discord.js'
import { isErr } from '../../lib/configs/constants.js'
import { appLogEmbed, logTypeColors } from '../../lib/discord/builders/admin.js'
import GuildWrapper from '../api/Khronos/guild/guild-wrapper.js'
import type { LogType } from './AppLog.interface.js'

interface LogParams {
	guildId: string
	description: string
	type: LogType
}

/**
 * @summary Logs a message to the specified guild's log channel.
 *
 * @param {LogParams} params - The parameters for the log.
 * @param {string} params.guildId - The ID of the guild.
 * @param {string} params.description - The description of the log message.
 * @param {LogType} params.type - The type of log message.
 * @returns {Promise<void>} - A promise that resolves when the log is sent.
 */
export default class AppLog {
	public static async log(params: LogParams): Promise<void> {
		try {
			const logChannel = (await new GuildWrapper().getLogChannel(
				params.guildId,
			)) as TextChannel
			if (!logChannel) {
				console.error(
					`Log channel not found for guild ${params.guildId}`,
				)
				return
			}

			const appAvatar =
				container.client.user?.avatarURL() ??
				container.client.user?.defaultAvatarURL ??
				null

			const embed = appLogEmbed(
				params.description,
				params.type,
				appAvatar,
			)

			await logChannel.send({ embeds: [embed] })
		} catch (error: unknown) {
			const ensuredError = isErr(error)
			console.error(
				`Failed to send log for guild ${params.guildId}:`,
				ensuredError,
			)
			console.error(
				`%c${ensuredError.message}`,
				`color: ${logTypeColors[params.type]}`,
			)
		}
	}
}
