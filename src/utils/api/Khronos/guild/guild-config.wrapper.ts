import {
	type CreateConfigDto,
	CreateConfigDtoSettingTypeEnum,
	DiscordConfigApi,
} from '@pluto-khronos/api-client'
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js'

/**
 * Khronos skips a guild's daily props when this row is `'false'`; a missing
 * row means enabled. The generated enum is available from client 3.15.0.
 */
export const PROPS_ENABLED_SETTING = CreateConfigDtoSettingTypeEnum.PropsEnabled

export default class GuildConfigWrapper {
	private discordConfigApi: DiscordConfigApi
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG
	constructor() {
		this.discordConfigApi = new DiscordConfigApi(this.khConfig)
	}

	async setGuildConfig(data: CreateConfigDto): Promise<void> {
		await this.discordConfigApi.setGuildConfig({ createConfigDto: data })
	}

	async setPredictionsChannel(
		guildId: string,
		channelId: string,
	): Promise<void> {
		await this.setGuildConfig({
			guild_id: guildId,
			setting_type: CreateConfigDtoSettingTypeEnum.PredictionsChan,
			setting_value: channelId,
		})
	}

	async setPropsEnabled(guildId: string, enabled: boolean): Promise<void> {
		await this.setGuildConfig({
			guild_id: guildId,
			setting_type: PROPS_ENABLED_SETTING,
			setting_value: enabled ? 'true' : 'false',
		})
	}
}
