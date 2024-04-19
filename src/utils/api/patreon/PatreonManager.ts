import { IPatreonReadUser, nonPatreonMemberMsg } from './interfaces.js'
import { patreonApiInstance } from './PatreonInstance.js'

export default class PatreonManager {
	readonly nonMemberMsg = nonPatreonMemberMsg
	patreonApi = patreonApiInstance
	constructor() {
		this.nonMemberMsg = nonPatreonMemberMsg
		this.patreonApi = patreonApiInstance
	}
	public async reqPatreonUserData(
		userid: string,
	): Promise<IPatreonReadUser | null> {
		try {
			const res = await this.patreonApi.get(`/read/${userid}`)
			return res.data as IPatreonReadUser
		} catch (error) {
			console.error(`[PatreonManager]:`, error)
			return null
		}
	}

	public sendNonMemberMsg() {
		return this.nonMemberMsg
	}
}
