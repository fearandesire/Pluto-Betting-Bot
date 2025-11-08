import axios, { AxiosHeaders, type AxiosInstance } from 'axios'
import env from '../../../lib/startup/env.js'

export class AxiosConfigurator {
	private readonly baseURL: string
	private readonly timeout: number
	private readonly headers: Record<string, string>

	constructor(
		baseURL: string,
		timeout = 90000, // 90 Seconds in MS
		headers: Record<string, string> = {},
	) {
		this.baseURL = baseURL
		this.timeout = timeout
		this.headers = headers
	}

	public createInstance(
		defaultParams: Record<string, string> = {},
	): AxiosInstance {
		const config = {
			baseURL: this.baseURL,
			timeout: this.timeout,
			headers: new AxiosHeaders({
				...this.headers,
			}),
		}
		return axios.create({
			...config,
			params: defaultParams,
		})
	}
}

const patreonApiInstance = new AxiosConfigurator(
	env.PATREON_API_URL,
	90000,
).createInstance()

export { patreonApiInstance }
