import { describe, expect, it, vi } from 'vitest'

const requiredEnv = {
	NODE_ENV: 'development',
	TOKEN: 'discord-token',
	PREFIX: '!',
	PROJECT_VERSION: 'test',
	KH_API_URL: 'http://khronos:3000',
	KH_API_TOKEN: 'kh-token',
	R_HOST: 'redis',
	R_PORT: '6379',
	R_DB: '0',
	R_PASS: 'redis-pass',
	API_URL: 'http://pluto:2090',
	API_KEY: 'api-key',
	PATREON_API_URL: 'http://patreon:3000',
	KH_PLUTO_CLIENT_KEY: 'client-key',
	APP_OWNER_ID: 'owner',
	AXIOM_DATASET: 'dataset',
	AXIOM_API_TOKEN: 'axiom-token',
	AXIOM_ORG_ID: 'org',
	BULL_BOARD_USERNAME: 'admin',
	BULL_BOARD_PASSWORD: 'password',
	LOKI_URL: 'http://loki:3100',
	LOKI_USER: 'loki',
	LOKI_PASS: 'loki-pass',
}

for (const [key, value] of Object.entries(requiredEnv)) {
	vi.stubEnv(key, value)
}

const { isSystemStartupMode, parseStartupEnv } = await import('../env.js')

describe('Pluto system startup env gate', () => {
	it('cannot activate system mode in production', () => {
		expect(() =>
			parseStartupEnv({
				...requiredEnv,
				NODE_ENV: 'production',
				PLUTO_SYSTEM_MODE: '1',
				PLUTO_SYSTEM_ALLOW: '1',
			}),
		).toThrow(/PLUTO_SYSTEM_MODE cannot be enabled/)
	})

	it('activates system mode only when both system flags are set outside production', () => {
		const env = parseStartupEnv({
			...requiredEnv,
			TOKEN: undefined,
			PLUTO_SYSTEM_MODE: '1',
			PLUTO_SYSTEM_ALLOW: '1',
		})

		expect(isSystemStartupMode(env)).toBe(true)
		expect(env.TOKEN).toBeUndefined()
	})

	it('keeps TOKEN required for normal production startup', () => {
		expect(() =>
			parseStartupEnv({
				...requiredEnv,
				NODE_ENV: 'production',
				TOKEN: undefined,
			}),
		).toThrow(/TOKEN is required/)
	})
})
