/**
 * @module KhronosApi
 * @readonly
 * @category KhronosApi
 * @description This module is used to establish access to the external API system, Khronos.
 * Khronos is the main API used for Pluto and handles most of it's features
 */
import {
	AccountsApi,
	BetslipsApi,
	Configuration,
	DiscordConfigApi,
	GuildsApi,
	MatchesApi,
} from '../../../openapi/khronos/index.js';
import * as dotenv from 'dotenv';

dotenv.config({
	path: '.env',
	override: true,
});

export const KH_API_CONFIG = new Configuration({
	basePath: `${process.env.KH_API_URL}`,
	headers: {
		'x-api-key': `${process.env.KH_PLUTO_CLIENT_KEY}`,
	},
});

export const AccountsInstance = new AccountsApi(KH_API_CONFIG);

export const BetslipsInstance = new BetslipsApi(KH_API_CONFIG);

export const ConfigInstance = new DiscordConfigApi(KH_API_CONFIG);

export const MatchesInstance = new MatchesApi(KH_API_CONFIG);

export const GuildsInstance = new GuildsApi(KH_API_CONFIG);

export type IKH_API_CONFIG = Configuration;
