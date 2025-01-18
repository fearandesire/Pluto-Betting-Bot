import {
	type GetGuildsBySportAndConfigTypeRequest,
	type Guild,
	GuildsApi,
} from '@kh-openapi';
import { container } from '@sapphire/framework';
import { isAxiosError } from 'axios';
import type { Channel } from 'discord.js';
import { DiscordConfigEnums } from '../../common/interfaces/kh-pluto/kh-pluto.interface.js';
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js';

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
		if (!guild.config || guild?.config.length === 0) {
			throw new Error('Guild does not have any configuration set');
		}
		const logChanConfig = guild.config.find(
			(config) => config.setting_type === DiscordConfigEnums.LOGS_CHAN,
		).setting_value;
		const logChannel = await container.client.channels.cache.get(logChanConfig);
		if (!logChannel) {
			console.error(`Log channel not found for guild ${guildId}`);
		}
		return logChannel;
	}

	async getGuildsForSportWithConfig(
		params: GetGuildsBySportAndConfigTypeRequest,
	): Promise<Guild[]> {
		const guilds = await this.guildsApi.getGuildsBySportAndConfigType(params);
		return guilds;
	}
}
