import axios, { AxiosHeaders } from 'axios'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import env from '../../../lib/startup/env.js'
import {
	outboundRequestId,
	REQUEST_ID_HEADER,
} from '../../../lib/telemetry/request-context.js'
import { checkBettingOutage } from '../Khronos/betting-outage.js'

/**
 * Axios Instance(s) configured for our needs to reduce redundant specifications/setup
 */

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const packageJsonPath = join(__dirname, '../../../../package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
const SERVICE_NAME = 'Pluto-Betting-Bot'
const SERVICE_VERSION = packageJson.version || '1.0.0'

const KhronosStandardConfig = {
	baseURL: `${env.KH_API_URL}`,
	timeout: 90000, // 90 Seconds in MS
	headers: new AxiosHeaders({
		'x-api-key': `${env.KH_PLUTO_CLIENT_KEY}`,
		'User-Agent': `${SERVICE_NAME}/${SERVICE_VERSION}`,
		'X-Service-Name': SERVICE_NAME,
	}),
}

const AxiosKhronosInstance = axios.create(KhronosStandardConfig)
AxiosKhronosInstance.interceptors.request.use((config) => {
	if (!config.headers.has(REQUEST_ID_HEADER)) {
		config.headers.set(REQUEST_ID_HEADER, outboundRequestId())
	}
	return config
})

// Parlay calls use this instance (ParlayApiWrapper). Betslip calls use the
// generated client's fetch hook in KhronosInstances.ts.
AxiosKhronosInstance.interceptors.response.use(undefined, (error: unknown) => {
	if (axios.isAxiosError(error)) {
		checkBettingOutage({
			url: error.config?.url ?? '',
			requestId: error.config?.headers
				?.get(REQUEST_ID_HEADER)
				?.toString(),
			status: error.response?.status,
			error,
		})
	}
	return Promise.reject(error)
})

export { AxiosKhronosInstance }
