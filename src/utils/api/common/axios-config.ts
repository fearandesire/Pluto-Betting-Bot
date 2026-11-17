import axios, { AxiosHeaders } from 'axios'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import env from '../../../lib/startup/env.js'
import {
	outboundRequestId,
	REQUEST_ID_HEADER,
} from '../../../lib/telemetry/request-context.js'
import { reportBettingFailure } from '../../../services/alerts/betting-ops-alert.js'

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

const BETSLIP_PATH = /betslips\//

/**
 * Pages ops when a betting request times out or Khronos returns a 5xx. The
 * alert names the route, never the path's ids, and the error is rethrown
 * unchanged so callers behave exactly as before.
 */
function reportKhronosBettingFailure(error: unknown): void {
	if (!axios.isAxiosError(error)) return
	const url = error.config?.url ?? ''
	if (!BETSLIP_PATH.test(url)) return
	const timedOut = error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT'
	const status = error.response?.status
	if (!timedOut && (status === undefined || status < 500)) return
	const route = url.split('/').slice(0, 2).join('/')
	const cause = timedOut ? 'timeout' : `HTTP ${status}`
	reportBettingFailure({
		key: `khronos.betting_unavailable:${route}:${cause}`,
		event: 'khronos.betting_unavailable',
		requestId: String(error.config?.headers?.get(REQUEST_ID_HEADER) ?? ''),
		error: new Error(`Khronos betting ${cause} on ${route}`),
	})
}

AxiosKhronosInstance.interceptors.response.use(undefined, (error: unknown) => {
	reportKhronosBettingFailure(error)
	return Promise.reject(error)
})

export { AxiosKhronosInstance }
