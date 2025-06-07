import type { Container } from '@sapphire/framework';
import type { Guild, TextBasedChannel, User } from 'discord.js';

export default class ClientTools {
	constructor(private container: Container) {}

	async resolveMember(userId: string): Promise<User | null> {
		return await this.container.client.users.fetch(userId).catch(() => null);
	}

	async resolveGuild(guildId: string): Promise<Guild | null> {
		return await this.container.client.guilds.fetch(guildId).catch(() => null);
	}

	async resolveChannel(channelId: string): Promise<TextBasedChannel | null> {
		return await this.container.client.channels
			.fetch(channelId)
			.catch(() => null);
	}
}
