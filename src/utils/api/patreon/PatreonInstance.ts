import axios, { AxiosHeaders, AxiosInstance } from 'axios'
import { PATREON_API_KEY, PATREON_API_URL } from './config.js'

export class AxiosConfigurator {
	private readonly baseURL: string
	private readonly timeout: number
	private readonly headers: Record<string, string>

	constructor(
		baseURL: string,
		timeout: number = 90000, // 90 Seconds in MS
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
	PATREON_API_URL!,
	90000,
).createInstance()

export { patreonApiInstance }
