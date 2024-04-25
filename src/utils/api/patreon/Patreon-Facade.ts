import PatreonManager from './PatreonManager.js'
import { IPatreonReadUser, PatreonTiers } from './interfaces.js'

export default class PatreonFacade {
	static readonly patreonManager = new PatreonManager()

	/**
	 * Retrieves Patreon member data to directly return response if the user is a Patreon member
	 * @returns {Promise<false | IPatreonReadUser>} - false if the user is not a Patreon member, otherwise the member data
	 * @param userId
	 */
	static async memberDetails(
		userId: string,
	): Promise<false | IPatreonReadUser> {
		const memberData = await this.patreonManager.reqPatreonUserData(userId)
		if (!memberData) {
			return false
		} else {
			return memberData
		}
	}

	/**
	 * Checks if the user is a Patreon member at the sponsor tier
	 * @param userId - The ID of the user
	 * @returns {Promise<boolean>} - true if the user is a sponsor-tier Patreon member, otherwise false
	 */
	static async isSponsorTier(userId: string): Promise<boolean> {
		const memberDetails = await this.memberDetails(userId)
		return (
			memberDetails &&
			memberDetails.tier.toLowerCase() ===
				PatreonTiers.SPONSOR.toLowerCase()
		)
	}

	static async isSupporterTier(userId: string): Promise<boolean> {
		const memberDetails = await this.memberDetails(userId)
		return (
			memberDetails &&
			memberDetails.tier.toLowerCase() ===
				PatreonTiers.SUPPORTER.toLowerCase()
		)
	}
}
