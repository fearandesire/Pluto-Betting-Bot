import { createHash } from 'node:crypto'
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

/**
 * Reads the identity markers channels carried before #742 so their state moves
 * into the ledger instead of being lost. Remove after 2026-11-08: game
 * channels are deleted after their game, so none can remain by then.
 * `v1` marks a V1 channel, which has no V2 delivery phase.
 */
export function legacyTopicDelivery(
	topic: string | null | undefined,
	guildId: string,
	gameId: string,
): 'v1' | 'unsent' | 'sent' | null {
	const marker = `pluto-game:${createHash('sha256').update(`${guildId}:${gameId}`).digest('hex').slice(0, 24)}`
	if (topic === marker) return 'v1'
	if (topic === `${marker} | pluto-presentation:v2`) return 'sent'
	if (topic === `${marker} | pluto-presentation:v2:unsent`) return 'unsent'
	return null
}

/** Swaps a legacy marker topic for the guild's member-facing topic. */
export async function replaceLegacyTopic(
	channel: Pick<TextChannel, 'setTopic'>,
	guild: Pick<GuildEligibility, 'guildId' | 'gameChannelTopic'>,
): Promise<void> {
	await channel.setTopic(gameChannelTopic(guild))
}
