import { GuildsApi } from '@kh-openapi';
import { type IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js';

export default class GuildWrapper {
	private guildsApi: GuildsApi;
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG;
	constructor() {
		this.guildsApi = new GuildsApi(this.khConfig);
	}
	async getGuild(guildId: string): Promise<any> {
		return await this.guildsApi.getGuildById({
			id: guildId,
		});
	}
}
