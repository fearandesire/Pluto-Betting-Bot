import { AxiosKhronosInstance } from './axios-config.js'
import { OutgoingEndpoints } from './endpoints.js'
import { AxiosInstance } from 'axios'

export default class KhronosReqHandler {
	private khronosAxios: AxiosInstance
	constructor() {
		this.khronosAxios = AxiosKhronosInstance
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
