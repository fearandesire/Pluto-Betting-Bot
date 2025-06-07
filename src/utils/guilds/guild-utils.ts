import type { Guild } from 'discord.js';
import _ from 'lodash';
import { SapDiscClient } from '../../index.js';

export default class GuildUtils {
	async findEmoji(name: string) {
		const normalizedName = await normalizeEmojiName(name);
		const lowerEmojiName = normalizedName.toLowerCase();
		const emojiCache = SapDiscClient.emojis.cache;

		// First, try to find an exact match
		const exactMatch = await emojiCache.find(
			(emoji) => emoji.name && emoji.name.toLowerCase() === lowerEmojiName,
		);
		if (exactMatch) {
			return exactMatch;
		}

		// If no exact match is found, try matching with numbers
		if (/\d/.test(lowerEmojiName)) {
			const numericMatch = await emojiCache.find((emoji) => {
				if (!emoji?.name) return false;
				// Special handling for numeric team names (e.g. 76ers)
				return (
					emoji.name.toLowerCase().replace(/[\s_-]/g, '') ===
					lowerEmojiName.replace(/[\s_-]/g, '')
				);
			});
			if (numericMatch) return numericMatch;
		}

		// If still no match, find the first partial match
		const partialMatch = await emojiCache.find(
			(emoji) =>
				emoji.name &&
				lowerEmojiName &&
				emoji.name.toLowerCase().includes(lowerEmojiName),
		);
		return partialMatch ?? null;
	}

	async constructTeamString(teamName: string) {
		const emoji = await this.findEmoji(teamName);
		return emoji ? `${emoji} ${teamName}` : teamName;
	}

	async getGuild(guildId: string) {
		return SapDiscClient.guilds.cache.get(guildId);
	}

	async getChan(guild: Guild, chanId: string) {
		return guild.channels.cache.get(chanId);
	}

	async getUser(guild: Guild, userId: string) {
		return guild.members.cache.get(userId);
	}

	async getChanViaGuild(args: {
		guildId?: string;
		guild?: Guild;
		chanId: string;
	}) {
		const { guildId, guild, chanId } = args || null;
		if (guildId) {
			const fetchedGuild = await this.getGuild(guildId);
			if (!fetchedGuild) {
				throw new Error('Guild not found');
			}
			return this.getChan(fetchedGuild, chanId);
		}
		if (guild) {
			return this.getChan(guild, chanId);
		}
	}
}

/**
 * Normalizes an emoji name by handling special cases and removing unnecessary characters
 * @param name The emoji name to normalize
 * @returns The normalized emoji name
 */
function normalizeEmojiName(name: string): string {
	let normalizedName = name;

	// If name contains spaces, take the last part (e.g. "Toronto Raptors" -> "Raptors")
	if (normalizedName.includes(' ')) {
		normalizedName = _.last(_.split(normalizedName, ' ')) || normalizedName;
	}

	// Remove any colons that might be in the name
	normalizedName = normalizedName.replace(/:/g, '');

	// Handle special cases for team names with numbers
	if (/\d/.test(normalizedName)) {
		normalizedName = normalizedName.replace(/[\s_-]/g, '').toLowerCase();
	}

	return normalizedName;
}
