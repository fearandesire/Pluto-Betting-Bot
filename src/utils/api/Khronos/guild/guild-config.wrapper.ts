import { type CreateConfigDto, DiscordConfigApi } from '@khronos-index';
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js';

export default class GuildConfigWrapper {
	private discordConfigApi: DiscordConfigApi;
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG;
	constructor() {
		this.discordConfigApi = new DiscordConfigApi(this.khConfig);
	}

	async setGuildConfig(data: CreateConfigDto): Promise<void> {
		await this.discordConfigApi.setGuildConfig({ createConfigDto: data });
	}
}
