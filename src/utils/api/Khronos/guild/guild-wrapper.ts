import {
	type GetGuildsBySportAndConfigTypeRequest,
	type Guild,
	GuildsApi,
} from '@kh-openapi';
import { container } from '@sapphire/framework';
import { isAxiosError } from 'axios';
import type { TextChannel, Message, MessageCreateOptions } from 'discord.js';
import { DiscordConfigEnums } from '../../common/interfaces/kh-pluto/kh-pluto.interface.js';
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js';

/**
 * Wrapper class for guild-related operations
 * Provides utilities to fetch guild data, configurations, and send messages to configured channels
 */
export default class GuildWrapper {
	private guildsApi: GuildsApi;
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG;
	
	constructor() {
		this.guildsApi = new GuildsApi(this.khConfig);
	}
	/**
	 * Fetches guild data from Khronos API
	 * @param guildId - Discord guild ID
	 * @returns Guild entity with configuration
	 * @throws Error if API request fails
	 */
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

	/**
	 * Retrieves the configured log channel for a guild
	 * @param guildId - Discord guild ID
	 * @returns TextChannel for logging
	 * @throws Error if guild has no configuration or log channel not found
	 */
	async getLogChannel(guildId: string): Promise<TextChannel> {
		const guild = await this.getGuild(guildId);
		if (!guild.config || guild?.config.length === 0) {
			throw new Error('Guild does not have any configuration set');
		}
		const logChanConfig = guild.config.find(
			(config) => config.setting_type === DiscordConfigEnums.LOGS_CHAN,
		);
		
		if (!logChanConfig) {
			throw new Error(`Log channel not configured for guild ${guildId}`);
		}
		
		const logChannel = container.client.channels.cache.get(logChanConfig.setting_value) as TextChannel;
		if (!logChannel) {
			throw new Error(`Log channel not found for guild ${guildId}`);
		}
		return logChannel;
	}

	/**
	 * Retrieves the configured prediction channel for a guild
	 * @param guildId - Discord guild ID
	 * @returns TextChannel for posting predictions/props
	 * @throws Error if guild has no configuration or prediction channel not configured
	 */
	async getPredictionChannel(guildId: string): Promise<TextChannel> {
		const guild = await this.getGuild(guildId);
		if (!guild.config || guild?.config.length === 0) {
			throw new Error('Guild does not have any configuration set');
		}
		
		const predictionChanConfig = guild.config.find(
			(config) => config.setting_type === DiscordConfigEnums.PREDICTIONS_CHAN,
		);
		
		if (!predictionChanConfig) {
			throw new Error(`Prediction channel not configured for guild ${guildId}`);
		}
		
		const predictionChannel = container.client.channels.cache.get(predictionChanConfig.setting_value) as TextChannel;
		if (!predictionChannel) {
			throw new Error(`Prediction channel not found for guild ${guildId}`);
		}
		return predictionChannel;
	}

	/**
	 * Sends a message to the guild's configured prediction channel
	 * @param guildId - Discord guild ID
	 * @param options - Discord message options (embeds, components, content, etc.)
	 * @returns The sent message
	 * @throws Error if prediction channel not configured or message send fails
	 * @example
	 * ```typescript
	 * await guildWrapper.sendToPredictionChannel(guildId, {
	 *   embeds: [embed],
	 *   components: [actionRow]
	 * });
	 * ```
	 */
	async sendToPredictionChannel(
		guildId: string,
		options: MessageCreateOptions,
	): Promise<Message> {
		const predictionChannel = await this.getPredictionChannel(guildId);
		return await predictionChannel.send(options);
	}

	/**
	 * Sends a message to the guild's configured log channel
	 * @param guildId - Discord guild ID
	 * @param options - Discord message options (embeds, components, content, etc.)
	 * @returns The sent message
	 * @throws Error if log channel not configured or message send fails
	 * @example
	 * ```typescript
	 * await guildWrapper.sendToLogChannel(guildId, {
	 *   embeds: [logEmbed]
	 * });
	 * ```
	 */
	async sendToLogChannel(
		guildId: string,
		options: MessageCreateOptions,
	): Promise<Message> {
		const logChannel = await this.getLogChannel(guildId);
		return await logChannel.send(options);
	}

	/**
	 * Fetches guilds filtered by sport and configuration type
	 * @param params - Filter parameters (sport, config type)
	 * @returns Array of guilds matching the criteria
	 */
	async getGuildsForSportWithConfig(
		params: GetGuildsBySportAndConfigTypeRequest,
	): Promise<Guild[]> {
		const guilds = await this.guildsApi.getGuildsBySportAndConfigType(params);
		return guilds;
	}
}
