import { AxiosError } from 'axios';
import type { IApiError } from '../../../lib/interfaces/errors/api-errors.js';
import { patreonApiInstance } from './patreon-instance.js';
import { type IPatreonReadUser, nonPatreonMemberMsg } from './interfaces.js';
export default class PatreonManager {
	readonly nonMemberMsg = nonPatreonMemberMsg;
	patreonApi = patreonApiInstance;
	constructor() {
		this.nonMemberMsg = nonPatreonMemberMsg;
		this.patreonApi = patreonApiInstance;
	}
	public async reqPatreonUserData(
		userid: string,
	): Promise<IPatreonReadUser | IApiError> {
		try {
			const res = await this.patreonApi.get(`/read/${userid}`);
			return res.data as IPatreonReadUser;
		} catch (error) {
			// 404 == Not a member
			if (error instanceof AxiosError && error.response?.status === 404) {
				return;
			}
			return {
				message: 'Failed to fetch Patreon user data',
				metadata: {
					userId: userid,
					error: error instanceof Error ? error.message : String(error),
				},
			};
		}
	}

	public sendNonMemberMsg() {
		return this.nonMemberMsg;
	}
}
