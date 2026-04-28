import env from '../../lib/startup/env.js'
import { MockBackend } from './mock-backend.js'

export function isMockEnabled(): boolean {
	return env.USE_MOCK_DATA
}

export { MockBackend }
