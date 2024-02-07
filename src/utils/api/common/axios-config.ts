import axios, { AxiosHeaders } from 'axios'

/**
 * Axios Instance(s) configured for our needs to reduce redundant specifications/setup
 */

const KhronosStandardConfig = {
	baseURL: `${process.env.PLUTO_API_URL}`,
	timeout: 90000, // 90 Seconds in MS
	headers: new AxiosHeaders({
		'admin-token': `${process.env.PLUTO_API_TOKEN}`,
	}),
}

const AxiosKhronosInstance = axios.create(KhronosStandardConfig)

export { AxiosKhronosInstance }
