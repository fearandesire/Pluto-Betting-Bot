import {
	type GetGuildsBySportAndConfigTypeRequest,
	type Guild,
	GuildsApi,
} from '@kh-openapi'
import { container } from '@sapphire/framework'
import { isAxiosError } from 'axios'
import {
	type Channel,
	ChannelType,
	type Message,
	type MessageCreateOptions,
	type TextChannel,
} from 'discord.js'
import { DiscordConfigEnums } from '../../common/interfaces/kh-pluto/kh-pluto.interface.js'
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js'

/**
 * Wrapper class for guild-related operations
 * Provides utilities to fetch guild data, configurations, and send messages to configured channels
 */
export default class GuildWrapper {
	private guildsApi: GuildsApi
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG

	constructor() {
		this.guildsApi = new GuildsApi(this.khConfig)
	}

	/**
	 * Validates that a string is a valid Discord snowflake (17-19 digits)
	 * @param value - Value to validate
	 * @param channelType - Type of channel for error message context
	 * @param guildId - Guild ID for error message context
	 * @throws Error if value is not a valid snowflake
	 */
	private validateSnowflake(
		value: string,
		channelType: string,
		guildId: string,
	): void {
		const snowflakeRegex = /^\d{17,19}$/
		if (!snowflakeRegex.test(value)) {
			throw new Error(
				`Invalid ${channelType} channel ID format for guild ${guildId}: expected Discord snowflake (17-19 digits), got "${value}"`,
			)
		}
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
			})
		} catch (error) {
			if (isAxiosError(error)) {
				console.error(
					'Error making API request to retrieve guild data.',
					{
						guildId,
						error: error.response?.data,
					},
				)
			} else {
				console.error(
					'Error making API request to retrieve guild data.',
					{
						guildId,
						error,
					},
				)
			}
			throw error
		}
	}

	/**
	 * Retrieves a configured channel for a guild by config type
	 *
	 * @param guildId - Discord guild ID
	 * @param configType - Configuration type enum
	 * @param channelTypeLabel - Label for error messages (e.g., "log", "prediction")
	 * @returns TextChannel for the configured channel
	 * @throws {Error} If channel not configured, not found, or not a text channel
	 */
	private async getConfiguredChannel(
		guildId: string,
		configType: DiscordConfigEnums,
		channelTypeLabel: string,
	): Promise<TextChannel> {
		const guild = await this.getGuild(guildId)
		if (!guild.config || guild.config.length === 0) {
			throw new Error('Guild does not have any configuration set')
		}

		const channelConfig = guild.config.find(
			(config) => config.setting_type === configType,
		)

		if (!channelConfig) {
			throw new Error(
				`${channelTypeLabel.charAt(0).toUpperCase() + channelTypeLabel.slice(1)} channel not configured for guild ${guildId}`,
			)
		}

		this.validateSnowflake(
			channelConfig.setting_value,
			channelTypeLabel,
			guildId,
		)

		let channel: Channel
		try {
			channel = await container.client.channels.fetch(
				channelConfig.setting_value,
			)
		} catch (error) {
			throw new Error(
				`Failed to fetch ${channelTypeLabel} channel for guild ${guildId} (channel ID: ${channelConfig.setting_value}): ${error instanceof Error ? error.message : String(error)}`,
			)
		}

		if (channel.type !== ChannelType.GuildText) {
			throw new Error(
				`${channelTypeLabel.charAt(0).toUpperCase() + channelTypeLabel.slice(1)} channel for guild ${guildId} is not a text channel (got ${ChannelType[channel.type]})`,
			)
		}

		return channel as TextChannel
	}

	/**
	 * Retrieves the configured log channel for a guild
	 * @param guildId - Discord guild ID
	 * @returns TextChannel for logging
	 * @throws Error if guild has no configuration or log channel not found
	 */
	async getLogChannel(guildId: string): Promise<TextChannel> {
		return this.getConfiguredChannel(
			guildId,
			DiscordConfigEnums.LOGS_CHAN,
			'log',
		)
	}

	/**
	 * Retrieves the configured prediction channel for a guild
	 * @param guildId - Discord guild ID
	 * @returns TextChannel for posting predictions/props
	 * @throws Error if guild has no configuration or prediction channel not configured
	 */
	async getPredictionChannel(guildId: string): Promise<TextChannel> {
		return this.getConfiguredChannel(
			guildId,
			DiscordConfigEnums.PREDICTIONS_CHAN,
			'prediction',
		)
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
		const predictionChannel = await this.getPredictionChannel(guildId)
		return await predictionChannel.send(options)
	}

	/**
	 * Retrieves the configured betting channel for a guild
	 * @param guildId - Discord guild ID
	 * @returns TextChannel for posting bets
	 * @throws Error if guild has no configuration or betting channel not configured
	 */
	async getBettingChannel(guildId: string): Promise<TextChannel> {
		return this.getConfiguredChannel(
			guildId,
			DiscordConfigEnums.BETTING_CHANNEL,
			'betting',
		)
	}

	/**
	 * Sends a message to the guild's configured betting channel
	 * @param guildId - Discord guild ID
	 * @param options - Discord message options (embeds, components, content, etc.)
	 * @returns The sent message
	 * @throws Error if betting channel not configured or message send fails
	 */
	async sendToBettingChannel(
		guildId: string,
		options: MessageCreateOptions,
	): Promise<Message> {
		const bettingChannel = await this.getBettingChannel(guildId)
		return await bettingChannel.send(options)
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
		const logChannel = await this.getLogChannel(guildId)
		return await logChannel.send(options)
	}

	/**
	 * Fetches guilds filtered by sport and configuration type
	 * @param params - Filter parameters (sport, config type)
	 * @returns Array of guilds matching the criteria
	 */
	async getGuildsForSportWithConfig(
		params: GetGuildsBySportAndConfigTypeRequest,
	): Promise<Guild[]> {
		const guilds =
			await this.guildsApi.getGuildsBySportAndConfigType(params)
		return guilds
	}
}
