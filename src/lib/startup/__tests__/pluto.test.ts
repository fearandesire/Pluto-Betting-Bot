import { describe, expect, it, vi } from 'vitest'
import type { ParsedStartupEnv } from '../env.js'

const baseEnv: ParsedStartupEnv = {
	NODE_ENV: 'development',
	TOKEN: 'discord-token',
	PREFIX: '!',
	PROJECT_VERSION: 'test',
	KH_API_URL: 'http://khronos:3000',
	KH_API_TOKEN: 'kh-token',
	R_HOST: 'redis',
	R_PORT: 6379,
	R_DB: 0,
	R_PASS: 'redis-pass',
	API_PORT: 2090,
	API_URL: 'http://pluto:2090',
	LOG_LEVEL: 'Info',
	PATREON_API_URL: 'http://patreon:3000',
	KH_PLUTO_CLIENT_KEY: 'client-key',
	APP_OWNER_ID: 'owner',
	AXIOM_DATASET: 'dataset',
	AXIOM_API_TOKEN: 'axiom-token',
	AXIOM_ORG_ID: 'org',
	BULL_BOARD_USERNAME: 'admin',
	BULL_BOARD_PASSWORD: 'password',
	API_KEY: 'api-key',
	LOKI_URL: 'http://loki:3100',
	LOKI_USER: 'loki',
	LOKI_PASS: 'loki-pass',
	MAINTENANCE_MODE: false,
	USE_MOCK_DATA: false,
	MOCK_GUILD_SPORT: 'nba',
	ANNOUNCE_PAYOUT_THRESHOLD: 100,
	ANNOUNCE_MAX_PER_HOUR: 5,
	BIG_WIN_ANNOUNCEMENTS_ENABLED: true,
	RECAP_CRON: '0 9 * * 1',
	RECAP_ENABLED: true,
	RECAP_GUILD_IDS: '',
	PLUTO_SYSTEM_MODE: false,
	PLUTO_SYSTEM_ALLOW: false,
}

vi.mock('../env.js', () => ({
	default: {},
	isSystemStartupMode: (env: ParsedStartupEnv) =>
		env.PLUTO_SYSTEM_MODE &&
		env.PLUTO_SYSTEM_ALLOW &&
		env.NODE_ENV !== 'production',
}))

vi.mock('../../../utils/api/routes/notifications/delivery-queue.js', () => ({
	configureSystemNotificationDelivery: vi.fn(),
	resetNotificationDeliveryQueue: vi.fn(),
}))

vi.mock('../../../utils/logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), error: vi.fn() },
}))

const { startPluto } = await import('../pluto.js')

describe('Pluto startup orchestration', () => {
	it('does not call Discord gateway login in system mode', async () => {
		const client = {
			login: vi.fn(),
			destroy: vi.fn(),
			logger: { fatal: vi.fn() },
		}
		const initializeSystemStartupServices = vi.fn(async () => undefined)

		await startPluto({
			client,
			env: {
				...baseEnv,
				TOKEN: undefined,
				PLUTO_SYSTEM_MODE: true,
				PLUTO_SYSTEM_ALLOW: true,
			},
			initializeSystemStartupServices,
			initializeStartupServices: vi.fn(async () => undefined),
			exitProcess: vi.fn(),
		})

		expect(initializeSystemStartupServices).toHaveBeenCalledOnce()
		expect(client.login).not.toHaveBeenCalled()
		expect(client.destroy).not.toHaveBeenCalled()
	})

	it('still calls Discord gateway login for normal startup', async () => {
		const client = {
			login: vi.fn(async () => 'ready'),
			destroy: vi.fn(),
			logger: { fatal: vi.fn() },
		}

		await startPluto({
			client,
			env: baseEnv,
			initializeStartupServices: vi.fn(async () => undefined),
			initializeSystemStartupServices: vi.fn(async () => undefined),
			exitProcess: vi.fn(),
		})

		expect(client.login).toHaveBeenCalledWith('discord-token')
	})
})
