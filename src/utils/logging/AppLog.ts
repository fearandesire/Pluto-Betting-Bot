import { container } from '@sapphire/framework';
import {
	type ColorResolvable,
	EmbedBuilder,
	type TextChannel,
} from 'discord.js';
import embedColors from '../../lib/colorsConfig.js';
import { isErr } from '../../lib/configs/constants.js';
import GuildWrapper from '../api/Khronos/guild/guild-wrapper.js';
import { LogType } from './AppLog.interface.js';

interface LogParams {
	guildId: string;
	description: string;
	type: LogType;
}

const logTypeColors: Record<LogType, ColorResolvable> = {
	[LogType.Error]: embedColors.error,
	[LogType.Info]: embedColors.info,
	[LogType.Warning]: embedColors.warning,
	[LogType.Success]: embedColors.success,
};

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
			)) as TextChannel;
			if (!logChannel) {
				console.error(`Log channel not found for guild ${params.guildId}`);
				return;
			}

			const appAvatar =
				container.client.user?.avatarURL() ??
				container.client.user?.defaultAvatarURL ??
				null;

			const logMetadata = {
				avatar: appAvatar,
				author: 'Pluto',
			};
			const { avatar, author } = logMetadata;

			const embed = new EmbedBuilder()
				.setDescription(params.description)
				.setColor(logTypeColors[params.type])
				.setAuthor({
					name: author,
					iconURL: avatar,
				})
				.setTimestamp();

			await logChannel.send({ embeds: [embed] });
		} catch (error: unknown) {
			const ensuredError = isErr(error);
			console.error(
				`Failed to send log for guild ${params.guildId}:`,
				ensuredError,
			);
			console.error(
				`%c${ensuredError.message}`,
				`color: ${logTypeColors[params.type]}`,
			);
		}
	}
}
