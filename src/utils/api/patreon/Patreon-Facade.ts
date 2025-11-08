import type { IApiError } from '../../../lib/interfaces/errors/api-errors.js'
import { type IPatreonReadUser, PatreonTiers } from './interfaces.js'
import PatreonManager from './PatreonManager.js'
export default class PatreonFacade {
	static readonly patreonManager = new PatreonManager()

	/**
	 * Retrieves Patreon member data to directly return response if the user is a Patreon member
	 * @returns {Promise<IPatreonReadUser | PatreonError | false>} - false if the user is not a Patreon member, PatreonError if there was an error, otherwise the member data
	 * @param userId
	 */
	static async memberDetails(
		userId: string,
	): Promise<IPatreonReadUser | IApiError | false> {
		const result =
			await PatreonFacade.patreonManager.reqPatreonUserData(userId)

		if (result && 'message' in result) {
			return result // This is a PatreonError
		}
		return result || false
	}

	/**
	 * Checks if the user is a Patreon member at the sponsor tier
	 * @param userId - The ID of the user
	 * @returns {Promise<boolean | PatreonError>} - true if the user is a sponsor-tier Patreon member, PatreonError if there was an error, otherwise false
	 */
	static async isSponsorTier(userId: string): Promise<boolean | IApiError> {
		const memberDetails = await PatreonFacade.memberDetails(userId)
		if (memberDetails === false) {
			return false
		}
		if ('message' in memberDetails) {
			return memberDetails
		}
		return (
			memberDetails.tier.toLowerCase() ===
			PatreonTiers.SPONSOR.toLowerCase()
		)
	}

	static async isSupporterTier(userId: string): Promise<boolean> {
		try {
			const memberDetails = await PatreonFacade.memberDetails(userId)
			if (!memberDetails || 'message' in memberDetails) {
				return false
			}
			const tier = memberDetails.tier.toLowerCase()
			return (
				tier === PatreonTiers.SUPPORTER.toLowerCase() ||
				tier === PatreonTiers.SPONSOR.toLowerCase()
			)
		} catch (error) {
			console.error('Error checking supporter tier:', error)
			return false
		}
	}
}
