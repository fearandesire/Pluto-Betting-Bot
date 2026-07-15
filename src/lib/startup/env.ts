import { z } from 'zod'

const envFlag = (value: unknown): boolean =>
	value === true || value === 'true' || value === '1'

const optionalNonEmptyString = z.preprocess(
	(value) => (value === '' ? undefined : value),
	z.string().min(1).optional(),
)

const requiredString = (message: string) => z.string().min(1, { message })

// Define the schema for our environment variables
const envSchema = z
	.object({
		NODE_ENV: z.enum(['development', 'production', 'test']),
		TOKEN: optionalNonEmptyString.describe(
			'Discord bot token used for authentication',
		),
		PREFIX: z.string(),
		PROJECT_VERSION: z.string(),
		KH_API_URL: z.url(),
		KH_API_TOKEN: requiredString(
			'KH_API_TOKEN is required for Khronos API authentication',
		),
		R_HOST: z.string(),
		R_PORT: z.number().int().positive(),
		R_DB: z.number().int().nonnegative(),
		R_PASS: requiredString('R_PASS is required'),
		API_PORT: z.number().int().positive(),
		API_URL: z.string().url().min(1, { message: 'API_URL is required' }),
		LOG_LEVEL: z.enum(['Trace', 'Debug', 'Info', 'Warn', 'Error', 'Fatal']),
		PATREON_API_URL: z
			.string()
			.url()
			.min(1, { message: 'PATREON_API_URL is required' }),
		KH_PLUTO_CLIENT_KEY: requiredString(
			'KH_PLUTO_CLIENT_KEY is required for Khronos API authentication',
		),
		APP_OWNER_ID: z.string(),
		AXIOM_DATASET: z.string(),
		AXIOM_API_TOKEN: requiredString(
			'AXIOM_API_TOKEN is required for Axiom logging',
		),
		AXIOM_ORG_ID: z.string(),
		BULL_BOARD_USERNAME: requiredString('BULL_BOARD_USERNAME is required'),
		BULL_BOARD_PASSWORD: requiredString('BULL_BOARD_PASSWORD is required'),
		API_KEY: requiredString('API_KEY is required for API authentication'),
		LOKI_URL: z.string(),
		LOKI_USER: requiredString('LOKI_USER is required'),
		LOKI_PASS: requiredString('LOKI_PASS is required'),
		MAINTENANCE_MODE: z.boolean(),
		USE_MOCK_DATA: z.boolean().default(false),
		MOCK_GUILD_BETTING_CHAN_ID: z.string().optional(),
		DEV_GUILD_GAMES_CATEGORY_ID: z.string().optional(),
		MOCK_GUILD_SPORT: z.enum(['nba', 'nfl']).default('nba'),
		ANNOUNCE_PAYOUT_THRESHOLD: z
			.number()
			.finite()
			.nonnegative()
			.default(100),
		ANNOUNCE_MAX_PER_HOUR: z.number().int().positive().default(5),
		BIG_WIN_ANNOUNCEMENTS_ENABLED: z.boolean().default(true),
		RECAP_CRON: z.string().default('0 9 * * 1'),
		RECAP_CHANNEL_ID: z.string().optional(),
		RECAP_ENABLED: z.boolean().default(true),
		RECAP_GUILD_IDS: z.string().default(''),
		PLUTO_SYSTEM_MODE: z.boolean().default(false),
		PLUTO_SYSTEM_ALLOW: z.boolean().default(false),
	})
	.superRefine((data, ctx) => {
		const systemFlagsSet = data.PLUTO_SYSTEM_MODE && data.PLUTO_SYSTEM_ALLOW
		// Hermetic XR/system boot requires both flags and NODE_ENV != production:
		// PLUTO_SYSTEM_MODE=1 PLUTO_SYSTEM_ALLOW=1 NODE_ENV=development|test.
		if (
			data.NODE_ENV === 'production' &&
			(data.PLUTO_SYSTEM_MODE || data.PLUTO_SYSTEM_ALLOW)
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['PLUTO_SYSTEM_MODE'],
				message:
					'PLUTO_SYSTEM_MODE cannot be enabled when NODE_ENV=production',
			})
		}
		if (data.PLUTO_SYSTEM_MODE !== data.PLUTO_SYSTEM_ALLOW) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['PLUTO_SYSTEM_ALLOW'],
				message:
					'PLUTO_SYSTEM_MODE and PLUTO_SYSTEM_ALLOW must both be enabled for system startup',
			})
		}
		const systemModeActive =
			systemFlagsSet && data.NODE_ENV !== 'production'
		if (!systemModeActive && !data.TOKEN) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['TOKEN'],
				message: 'TOKEN is required for Discord bot authentication',
			})
		}
		if (data.USE_MOCK_DATA && data.NODE_ENV === 'production') {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['USE_MOCK_DATA'],
				message:
					'USE_MOCK_DATA cannot be enabled when NODE_ENV=production',
			})
		}
		if (data.USE_MOCK_DATA) {
			if (!data.DEV_GUILD_GAMES_CATEGORY_ID) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['DEV_GUILD_GAMES_CATEGORY_ID'],
					message:
						'DEV_GUILD_GAMES_CATEGORY_ID is required when USE_MOCK_DATA is enabled — set it to the real Discord category ID where dev game channels will be created',
				})
			}
			if (!data.MOCK_GUILD_BETTING_CHAN_ID) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['MOCK_GUILD_BETTING_CHAN_ID'],
					message:
						'MOCK_GUILD_BETTING_CHAN_ID is required when USE_MOCK_DATA is enabled',
				})
			}
		}
	})

export type ParsedStartupEnv = z.infer<typeof envSchema>

export function parseStartupEnv(
	source: NodeJS.ProcessEnv = process.env,
): ParsedStartupEnv {
	return envSchema.parse({
		NODE_ENV: source.NODE_ENV,
		TOKEN: source.TOKEN,
		PREFIX: source.PREFIX,
		PROJECT_VERSION: source.PROJECT_VERSION,
		KH_API_URL: source.KH_API_URL,
		KH_API_TOKEN: source.KH_API_TOKEN,
		R_HOST: source.R_HOST,
		R_PORT: Number.parseInt(source.R_PORT || '6379', 10),
		R_DB: Number.parseInt(source.R_DB || '0', 10),
		R_PASS: source.R_PASS,
		API_PORT: Number.parseInt(source.APIPORT || '2090', 10),
		API_URL: source.API_URL,
		LOG_LEVEL: source.LOG_LEVEL || 'Info',
		PATREON_API_URL: source.PATREON_API_URL,
		KH_PLUTO_CLIENT_KEY: source.KH_PLUTO_CLIENT_KEY,
		APP_OWNER_ID: source.APP_OWNER_ID,
		AXIOM_DATASET: source.AXIOM_DATASET,
		AXIOM_API_TOKEN: source.AXIOM_API_TOKEN,
		AXIOM_ORG_ID: source.AXIOM_ORG_ID,
		BULL_BOARD_USERNAME: source.BULL_BOARD_USERNAME,
		BULL_BOARD_PASSWORD: source.BULL_BOARD_PASSWORD,
		API_KEY: source.API_KEY,
		LOKI_URL: source.LOKI_URL,
		LOKI_USER: source.LOKI_USER,
		LOKI_PASS: source.LOKI_PASS,
		MAINTENANCE_MODE: envFlag(source.MAINTENANCE_MODE),
		USE_MOCK_DATA: envFlag(source.USE_MOCK_DATA),
		MOCK_GUILD_BETTING_CHAN_ID: source.MOCK_GUILD_BETTING_CHAN_ID,
		DEV_GUILD_GAMES_CATEGORY_ID: source.DEV_GUILD_GAMES_CATEGORY_ID,
		MOCK_GUILD_SPORT: source.MOCK_GUILD_SPORT || 'nba',
		ANNOUNCE_PAYOUT_THRESHOLD: Number.parseFloat(
			source.ANNOUNCE_PAYOUT_THRESHOLD || '100',
		),
		ANNOUNCE_MAX_PER_HOUR: Number.parseInt(
			source.ANNOUNCE_MAX_PER_HOUR || '5',
			10,
		),
		BIG_WIN_ANNOUNCEMENTS_ENABLED:
			source.BIG_WIN_ANNOUNCEMENTS_ENABLED !== 'false',
		RECAP_CRON: source.RECAP_CRON,
		RECAP_CHANNEL_ID: source.RECAP_CHANNEL_ID,
		RECAP_ENABLED: source.RECAP_ENABLED !== 'false',
		RECAP_GUILD_IDS: source.RECAP_GUILD_IDS || source.GUILD_ID || '',
		PLUTO_SYSTEM_MODE: envFlag(source.PLUTO_SYSTEM_MODE),
		PLUTO_SYSTEM_ALLOW: envFlag(source.PLUTO_SYSTEM_ALLOW),
	})
}

export function isSystemStartupMode(env: ParsedStartupEnv): boolean {
	return (
		env.PLUTO_SYSTEM_MODE &&
		env.PLUTO_SYSTEM_ALLOW &&
		env.NODE_ENV !== 'production'
	)
}

// Parse and validate the environment variables
const env = parseStartupEnv()

// Debug logging for environment validation (redacts sensitive values)
const shouldLogDebug =
	process.env.DEBUG === 'true' || process.env.LOG_LEVEL === 'Debug'

if (shouldLogDebug) {
	const _safeEnv = {
		NODE_ENV: env.NODE_ENV,
		PREFIX: env.PREFIX,
		PROJECT_VERSION: env.PROJECT_VERSION,
		KH_API_URL: env.KH_API_URL,
		R_HOST: env.R_HOST,
		R_PORT: env.R_PORT,
		R_DB: env.R_DB,
		API_PORT: env.API_PORT,
		API_URL: env.API_URL,
		LOG_LEVEL: env.LOG_LEVEL,
		PATREON_API_URL: env.PATREON_API_URL,
		APP_OWNER_ID: env.APP_OWNER_ID,
		AXIOM_DATASET: env.AXIOM_DATASET,
		AXIOM_ORG_ID: env.AXIOM_ORG_ID,
		LOKI_URL: env.LOKI_URL,
		LOKI_USER: env.LOKI_USER,
		MAINTENANCE_MODE: env.MAINTENANCE_MODE,
		USE_MOCK_DATA: env.USE_MOCK_DATA,
		PLUTO_SYSTEM_MODE: env.PLUTO_SYSTEM_MODE,
		PLUTO_SYSTEM_ALLOW: env.PLUTO_SYSTEM_ALLOW,
		MOCK_GUILD_BETTING_CHAN_ID: env.MOCK_GUILD_BETTING_CHAN_ID,
		DEV_GUILD_GAMES_CATEGORY_ID: env.DEV_GUILD_GAMES_CATEGORY_ID,
		MOCK_GUILD_SPORT: env.MOCK_GUILD_SPORT,
		ANNOUNCE_PAYOUT_THRESHOLD: env.ANNOUNCE_PAYOUT_THRESHOLD,
		ANNOUNCE_MAX_PER_HOUR: env.ANNOUNCE_MAX_PER_HOUR,
		BIG_WIN_ANNOUNCEMENTS_ENABLED: env.BIG_WIN_ANNOUNCEMENTS_ENABLED,
		RECAP_CRON: env.RECAP_CRON,
		RECAP_CHANNEL_ID: env.RECAP_CHANNEL_ID,
		RECAP_ENABLED: env.RECAP_ENABLED,
		RECAP_GUILD_IDS: env.RECAP_GUILD_IDS,
		// Redacted sensitive fields
		TOKEN: '[REDACTED]',
		KH_API_TOKEN: '[REDACTED]',
		R_PASS: '[REDACTED]',
		KH_PLUTO_CLIENT_KEY: '[REDACTED]',
		AXIOM_API_TOKEN: '[REDACTED]',
		BULL_BOARD_USERNAME: '[REDACTED]',
		BULL_BOARD_PASSWORD: '[REDACTED]',
		API_KEY: '[REDACTED]',
		LOKI_PASS: '[REDACTED]',
	}
}

export default env
