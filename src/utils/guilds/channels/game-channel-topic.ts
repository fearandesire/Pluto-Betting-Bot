import {
	ChannelType,
	type Guild,
	type GuildChannelCreateOptions,
	type TextChannel,
} from 'discord.js'
import type { GuildEligibility } from '../../cache/data/schemas.js'
import { logger } from '../../logging/WinstonLogger.js'

export const DEFAULT_GAME_CHANNEL_TOPIC = 'Enjoy the game!'
const DISCORD_TOPIC_LIMIT = 1024
/** Internal state written as `pluto-game:<hash>` once leaked into topics (#604). */
const MACHINE_TOKEN = /\bpluto-[a-z-]+:/i

/**
 * Topics are read by server members, so they only ever hold the guild's
 * configured text. Channel identity and delivery state live in Redis and
 * Khronos, never in a Discord field people can see or edit.
 */
export function gameChannelTopic(
	guild: Pick<GuildEligibility, 'guildId' | 'gameChannelTopic'>,
): string {
	const custom = guild.gameChannelTopic?.trim()
	if (!custom) return DEFAULT_GAME_CHANNEL_TOPIC
	if (custom.length > DISCORD_TOPIC_LIMIT || MACHINE_TOKEN.test(custom)) {
		logger.warn({
			event: 'game_channel.topic_rejected',
			guildId: guild.guildId,
			length: custom.length,
		})
		return DEFAULT_GAME_CHANNEL_TOPIC
	}
	return custom
}

/** The only supported way to create a game channel. */
export async function createGameChannel(
	server: Guild,
	guild: Pick<GuildEligibility, 'guildId' | 'gameChannelTopic'>,
	options: { name: string; parent: GuildChannelCreateOptions['parent'] },
): Promise<TextChannel> {
	return server.channels.create({
		name: options.name,
		type: ChannelType.GuildText,
		topic: gameChannelTopic(guild),
		parent: options.parent,
	})
}
