import axios from 'axios'
import {
	admin_token,
	pluto_api_url,
	pluto_api_username,
} from '../../serverConfig.js'

export default class AuthManager {
	constructor() {
		this.ep = {
			channels: `game-channel`,
			auth: `auth`,
			validity: 'auth/valid',
			refresh: `auth/refresh`,
			gToken: `auth/stored-token`,
		}

		this.API_URL = pluto_api_url
	}

	async updateToken(token) {
		try {
			await axios.post(
				`${this.API_URL}/${this.ep.auth}`,
				{
					username: pluto_api_username,
					token,
				},
			)
		} catch (err) {
			console.error(err)
			throw err
		}
	}

	async isTokenExpired(token) {
		try {
			await axios.get(
				`${this.API_URL}/${this.ep.validity}`,
				{
					body: {
						token,
					},
				},
			)
			return false
		} catch (err) {
			if (err.response.status === 401) {
				return true
			}
			throw err
		}
	}

	async getToken() {
		try {
			const tokenReq = await axios.post(
				`${this.API_URL}/${this.ep.gToken}`,
				{
					username: pluto_api_username,
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
				`${this.API_URL}/${this.ep.refresh}`,
				{
					username: pluto_api_username,
				},
				{
					headers: {
						'admin-token': `${process.env.PLUTO_API_TOKEN}`,
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
