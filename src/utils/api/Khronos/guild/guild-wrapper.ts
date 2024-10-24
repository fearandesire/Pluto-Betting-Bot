import { GuildsApi, type Guild } from '@kh-openapi';
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js';
import type { Channel } from 'discord.js';
import { DiscordConfigEnums } from '../../common/interfaces/kh-pluto/kh-pluto.interface.js';
import { container } from '@sapphire/framework';
import { isAxiosError } from 'axios';

export default class GuildWrapper {
	static getLogChannel(
		guildId: string,
	):
		| import('discord.js').TextChannel
		| PromiseLike<import('discord.js').TextChannel> {
		throw new Error('Method not implemented.');
	}
	private guildsApi: GuildsApi;
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG;
	constructor() {
		this.guildsApi = new GuildsApi(this.khConfig);
	}
	async getGuild(guildId: string): Promise<Guild> {
		try {
			return await this.guildsApi.getGuildById({
				id: guildId,
			});
		} catch (error) {
			if (isAxiosError(error)) {
				console.error('Error making API request to retrieve guild data.', {
					guildId,
					error: error.response?.data,
				});
			} else {
				console.error('Error making API request to retrieve guild data.', {
					guildId,
					error,
				});
			}
			throw error;
		}
	}

	async getLogChannel(guildId: string): Promise<Channel> {
		const guild = await this.getGuild(guildId);
		if (!guild.discordConfig || guild?.discordConfig.length === 0) {
			throw new Error('Guild does not have discordConfig');
		}
		const logChanConfig = guild.discordConfig.find(
			(config) => config.setting_type === DiscordConfigEnums.LOGS_CHAN,
		).setting_value;
		const logChannel = await container.client.channels.cache.get(logChanConfig);
		if (!logChannel) {
			console.error(`Log channel not found for guild ${guildId}`);
		}
		return logChannel;
	}
}
