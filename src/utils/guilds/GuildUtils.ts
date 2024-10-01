import { SapDiscClient } from '../../index.js';
import _ from 'lodash';
import type { Guild } from 'discord.js';

export default class GuildUtils {
	async findEmoji(name: string) {
		const searchFor = await parseNameForEmoji(name.toLowerCase());
		const emojiCache = SapDiscClient.emojis.cache;

		// First, try to find an exact match
		const exactMatch = await emojiCache.find(
			(emoji) => emoji.name && emoji.name.toLowerCase() === searchFor,
		);
		if (exactMatch) {
			return exactMatch;
		}

		// If no exact match, find the first partial match
		const partialMatch = await emojiCache.find(
			(emoji) =>
				emoji.name && searchFor && emoji.name.toLowerCase().includes(searchFor),
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

async function parseNameForEmoji(name: string) {
	if (name.includes(' ')) {
		return _.last(_.split(name, ' '));
	}
	return name;
}
