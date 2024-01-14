import axios from 'axios'
import { admin_token, pluto_api_url, pluto_api_username } from "../../serverConfig.js"

export default class AuthManager {
	constructor() {
		this.API_URL = pluto_api_url
		this.ep = {
			channels: `game-channel`,
			auth: `auth`,
		}
	}

	async getToken() {
		try {
			const tokenReq = await axios.post(
				`${pluto_api_url}/auth/stored-token`,
				{
					username: `fenix`,
				},
				{
					headers: {
						'admin-token': `${admin_token}`,
					},
				},
			)
			return tokenReq.data.token
		} catch (err) {
			console.error(err)
			throw err
		}
	}

	async refreshToken() {
		try {
			const tokenReq = await axios.post(
				`${this.API_URL}/${this.ep.auth}/refresh`,
				{
					username:
					pluto_api_username,
				},
				{
					headers: {
						'admin-token': `${admin_token}`,
					},
				},
			)
			return tokenReq.data.access_token
		} catch (err) {
			console.error(err)
			throw err
		}
	}
}

