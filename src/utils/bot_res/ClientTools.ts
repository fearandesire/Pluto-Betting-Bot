import type { Container } from '@sapphire/framework';
import type { User } from 'discord.js';

export default class ClientTools {
	constructor(private container: Container) {}

	async resolveMember(userId: string): Promise<User | null> {
		return await this.container.client.users.fetch(userId).catch(() => null);
	}
}
