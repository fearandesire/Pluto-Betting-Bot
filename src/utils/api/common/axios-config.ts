import axios, { AxiosHeaders } from 'axios'
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import env from '../../../lib/startup/env.js'

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

export { AxiosKhronosInstance }
