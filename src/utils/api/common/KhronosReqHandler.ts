import { AxiosKhronosInstance } from './axios-config.js'
import { OutgoingEndpoints } from './endpoints.js'
import { AxiosInstance } from 'axios'
import {
	IAPIBetslipPayload,
	IPendingBetslipFull,
} from '../../../lib/interfaces/api/bets/betslips.interfaces'

export default class KhronosReqHandler {
	private khronosAxios: AxiosInstance
	constructor() {
		this.khronosAxios = AxiosKhronosInstance
	}

	async fetchPendingBet(userId: string) {
		return this.khronosAxios({
			method: 'get',
			url: `${OutgoingEndpoints.paths.bets.pending}/${userId}`,
		})
	}

	async initBetslip(payload: IAPIBetslipPayload) {
		return this.khronosAxios.post(
			OutgoingEndpoints.paths.bets.create, // Ensure this endpoint is for initializing a bet
			payload,
		)
	}

	async finalizeBetslip(payload: IPendingBetslipFull) {
		return this.khronosAxios.post(
			OutgoingEndpoints.paths.bets.place,
			payload,
		)
	}

	async cancelBet(userId: string, betId: number) {
		return this.khronosAxios.post(OutgoingEndpoints.paths.bets.cancel, {
			userid: userId,
			betid: betId,
		})
	}

	async postDailyClaim(userId: string) {
		return this.khronosAxios({
			method: 'post',
			url: `${OutgoingEndpoints.paths.accounts.dailyClaim}/${userId}`,
		})
	}

	async fetchUserProfile(userId: string) {
		return this.khronosAxios({
			method: 'get',
			url: `${OutgoingEndpoints.paths.accounts.getProfile}/${userId}`,
		})
	}
}
