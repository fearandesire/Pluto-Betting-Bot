import axios, { AxiosHeaders } from 'axios'
import env from '../../../lib/startup/env.js'

/**
 * Axios Instance(s) configured for our needs to reduce redundant specifications/setup
 */

const KhronosStandardConfig = {
	baseURL: `${env.KH_API_URL}`,
	timeout: 90000, // 90 Seconds in MS
	headers: new AxiosHeaders({
		'admin-token': `${env.KH_API_TOKEN}`,
	}),
}

const AxiosKhronosInstance = axios.create(KhronosStandardConfig)

export { AxiosKhronosInstance }
