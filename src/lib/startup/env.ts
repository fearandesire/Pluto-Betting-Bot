import { z } from 'zod'

// Define the schema for our environment variables
const envSchema = z
	.object({
		NODE_ENV: z.enum(['development', 'production']),
		TOKEN: z
			.string()
			.min(1, {
				message: 'TOKEN is required for Discord bot authentication',
			})
			.describe('Discord bot token used for authentication'),
		PREFIX: z.string(),
		PROJECT_VERSION: z.string(),
		KH_API_URL: z.url(),
		KH_API_TOKEN: z.string().min(1, {
			message: 'KH_API_TOKEN is required for Khronos API authentication',
		}),
		R_HOST: z.string(),
		R_PORT: z.number().int().positive(),
		R_DB: z.number().int().nonnegative(),
		R_PASS: z.string().min(1, { message: 'R_PASS is required' }),
		API_PORT: z.number().int().positive(),
		API_URL: z.string().url().min(1, { message: 'API_URL is required' }),
		LOG_LEVEL: z.enum(['Trace', 'Debug', 'Info', 'Warn', 'Error', 'Fatal']),
		PATREON_API_URL: z
			.string()
			.url()
			.min(1, { message: 'PATREON_API_URL is required' }),
		KH_PLUTO_CLIENT_KEY: z.string().min(1, {
			message:
				'KH_PLUTO_CLIENT_KEY is required for Khronos API authentication',
		}),
		APP_OWNER_ID: z.string(),
		AXIOM_DATASET: z.string(),
		AXIOM_API_TOKEN: z.string().min(1, {
			message: 'AXIOM_API_TOKEN is required for Axiom logging',
		}),
		AXIOM_ORG_ID: z.string(),
		BULL_BOARD_USERNAME: z
			.string()
			.min(1, { message: 'BULL_BOARD_USERNAME is required' }),
		BULL_BOARD_PASSWORD: z
			.string()
			.min(1, { message: 'BULL_BOARD_PASSWORD is required' }),
		API_KEY: z
			.string()
			.min(1, { message: 'API_KEY is required for API authentication' }),
		LOKI_URL: z.string(),
		LOKI_USER: z.string().min(1, { message: 'LOKI_USER is required' }),
		LOKI_PASS: z.string().min(1, { message: 'LOKI_PASS is required' }),
		MAINTENANCE_MODE: z.boolean(),
		USE_MOCK_DATA: z.boolean().default(false),
		MOCK_GUILD_BETTING_CHAN_ID: z.string().optional(),
		DEV_GUILD_GAMES_CATEGORY_ID: z.string().optional(),
		MOCK_GUILD_SPORT: z.enum(['nba', 'nfl']).default('nba'),
	})
	.superRefine((data, ctx) => {
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

// Parse and validate the environment variables
const env = envSchema.parse({
	NODE_ENV: process.env.NODE_ENV,
	TOKEN: process.env.TOKEN,
	PREFIX: process.env.PREFIX,
	PROJECT_VERSION: process.env.PROJECT_VERSION,
	KH_API_URL: process.env.KH_API_URL,
	KH_API_TOKEN: process.env.KH_API_TOKEN,
	R_HOST: process.env.R_HOST,
	R_PORT: Number.parseInt(process.env.R_PORT || '6379', 10),
	R_DB: Number.parseInt(process.env.R_DB || '0', 10),
	R_PASS: process.env.R_PASS,
	API_PORT: Number.parseInt(process.env.APIPORT || '2090', 10),
	API_URL: process.env.API_URL,
	LOG_LEVEL: process.env.LOG_LEVEL || 'Info',
	PATREON_API_URL: process.env.PATREON_API_URL,
	KH_PLUTO_CLIENT_KEY: process.env.KH_PLUTO_CLIENT_KEY,
	APP_OWNER_ID: process.env.APP_OWNER_ID,
	AXIOM_DATASET: process.env.AXIOM_DATASET,
	AXIOM_API_TOKEN: process.env.AXIOM_API_TOKEN,
	AXIOM_ORG_ID: process.env.AXIOM_ORG_ID,
	BULL_BOARD_USERNAME: process.env.BULL_BOARD_USERNAME,
	BULL_BOARD_PASSWORD: process.env.BULL_BOARD_PASSWORD,
	API_KEY: process.env.API_KEY,
	LOKI_URL: process.env.LOKI_URL,
	LOKI_USER: process.env.LOKI_USER,
	LOKI_PASS: process.env.LOKI_PASS,
	MAINTENANCE_MODE: process.env.MAINTENANCE_MODE === 'true',
	USE_MOCK_DATA: process.env.USE_MOCK_DATA === 'true',
	MOCK_GUILD_BETTING_CHAN_ID: process.env.MOCK_GUILD_BETTING_CHAN_ID,
	DEV_GUILD_GAMES_CATEGORY_ID: process.env.DEV_GUILD_GAMES_CATEGORY_ID,
	MOCK_GUILD_SPORT: process.env.MOCK_GUILD_SPORT || 'nba',
})

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
		MOCK_GUILD_BETTING_CHAN_ID: env.MOCK_GUILD_BETTING_CHAN_ID,
		DEV_GUILD_GAMES_CATEGORY_ID: env.DEV_GUILD_GAMES_CATEGORY_ID,
		MOCK_GUILD_SPORT: env.MOCK_GUILD_SPORT,
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
