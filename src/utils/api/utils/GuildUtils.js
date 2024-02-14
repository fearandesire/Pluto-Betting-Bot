import { SapDiscClient } from '@pluto-core'
import _ from 'lodash'

export default class GuiltUtils {
	static async findEmoji(name) {
		const searchFor = await parseNameForEmoji(name.toLowerCase())
		const emojiCache = await SapDiscClient.emojis.cache

		// First, try to find an exact match
		const exactMatch = await emojiCache.find(
			(emoji) => emoji.name.toLowerCase() === searchFor,
		)
		if (exactMatch) {
			return exactMatch
		}

		// If no exact match, find the first partial match
		const partialMatch = await emojiCache.find((emoji) =>
			emoji.name.toLowerCase().includes(searchFor),
		)
		return partialMatch || null
	}

	async getGuild(guildId) {
		return SapDiscClient.guilds.cache.get(guildId)
	}

	async getChan(guild, chanId) {
		return guild.channels.cache.get(chanId)
	}

	async getChanViaGuild(args) {
		const { guildId, guild, chanId } = args || null
		if (guildId) {
			const fetchedGuild = await this.getGuild(guildId)
			if (!fetchedGuild) {
				throw new Error('Guild not found')
			}
			return this.getChan(fetchedGuild, chanId)
		}
		if (guild) {
			return this.getChan(guild, chanId)
		}
	}
}

async function parseNameForEmoji(name) {
	if (name.includes(' ')) {
		return _.last(_.split(name, ' '))
	}
	return name
}
