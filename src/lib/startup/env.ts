import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({
	path: '.env',
});

// Define the schema for our environment variables
const envSchema = z.object({
	NODE_ENV: z.enum(['development', 'production']),
	TOKEN: z.string(),
	PREFIX: z.string(),
	PROJECT_VERSION: z.string(),
	KH_API_URL: z.string().url(),
	KH_API_TOKEN: z.string(),
	R_HOST: z.string(),
	R_PORT: z.number().int().positive(),
	R_DB: z.number().int().nonnegative(),
	R_PASS: z.string(),
	apiPort: z.number().int().positive(),
	apiURL: z.string().url(),
	logLevel: z.enum(['Trace', 'Debug', 'Info', 'Warn', 'Error', 'Fatal']),
	DEV_SERVER_ID: z.string(),
	PATREON_API_URL: z.string().url(),
	KH_PLUTO_CLIENT_KEY: z.string(),
	APP_OWNER_ID: z.string(),
});

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
	apiPort: Number.parseInt(process.env.apiPort || '2090', 10),
	apiURL: process.env.apiURL,
	logLevel: process.env.logLevel,
	DEV_SERVER_ID: process.env.DEV_SERVER_ID,
	PATREON_API_URL: process.env.PATREON_API_URL,
	KH_PLUTO_CLIENT_KEY: process.env.KH_PLUTO_CLIENT_KEY,
	APP_OWNER_ID: process.env.APP_OWNER_ID,
});

console.log({
	env,
});
export default env;