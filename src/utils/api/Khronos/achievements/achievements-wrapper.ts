import * as KhronosApiClient from '@pluto-khronos/api-client'
import pTimeout from 'p-timeout'
import { z } from 'zod'
import { KH_API_CONFIG } from '../KhronosInstances.js'

const DEFAULT_TIMEOUT_MS = 15_000

/**
 * The generated typed methods drop JSON fields the installed client does not
 * know. A newer server adds `track`, `kind` and `gates`, so the wrapper reads
 * the raw body and parses it here. Fields of the released contract are
 * required. Additive fields degrade to `undefined` when absent or malformed,
 * which renders as the released contract.
 */
const gateSchema = z.object({
	metric: z.string(),
	label: z.string(),
	unit: z.string(),
	comparator: z.string(),
	target: z.number(),
	current: z.number().nullable(),
	met: z.boolean(),
	/** False while Khronos does not store the data yet; older servers omit it. */
	tracked: z.boolean().optional().catch(undefined),
})

const additive = {
	track: z.string().optional().catch(undefined),
	kind: z.enum(['career', 'form']).optional().catch(undefined),
}

/** The typed fallback path hands back a Date; the raw body holds a string. */
const timestamp = z
	.union([z.string(), z.date()])
	.transform((value) => (value instanceof Date ? value.toISOString() : value))

const earnedSchema = z.object({
	key: z.string(),
	name: z.string(),
	description: z.string(),
	awarded_at: timestamp,
	...additive,
})

const lockedSchema = z.object({
	key: z.string(),
	name: z.string(),
	description: z.string(),
	progress: z.number(),
	target: z.number(),
	...additive,
	gates: z.array(gateSchema).optional().catch(undefined),
})

const summarySchema = z.object({
	settled_bets: z.number(),
	wins: z.number(),
	losses: z.number(),
	pushes: z.number(),
	net_profit: z.number(),
	best_win_payout: z.number().nullable(),
	settled_predictions: z.number(),
	prediction_hit_rate: z.number().nullable(),
})

const userAchievementsSchema = z.object({
	user_id: z.string(),
	earned: z.array(earnedSchema),
	locked: z.array(lockedSchema),
	summary: summarySchema,
})

export type AchievementGate = z.infer<typeof gateSchema>
export type EarnedAchievement = z.infer<typeof earnedSchema>
export type LockedAchievement = z.infer<typeof lockedSchema>
export type AchievementSummary = z.infer<typeof summarySchema>
export type UserAchievementsDto = z.infer<typeof userAchievementsSchema>

export const parseUserAchievements = (body: unknown): UserAchievementsDto =>
	userAchievementsSchema.parse(body)

export interface AchievementsApiClient {
	evaluateUserAchievements(userId: string): Promise<UserAchievementsDto>
	getUserAchievements(userId: string): Promise<UserAchievementsDto>
}

type RawRequest = { userId: string }
type RawResponse = { raw: { json(): Promise<unknown> } }

interface GeneratedAchievementsApiClient {
	evaluateUserAchievementsRaw?(request: RawRequest): Promise<RawResponse>
	getUserAchievementsRaw?(request: RawRequest): Promise<RawResponse>
	evaluateUserAchievements(request: RawRequest): Promise<unknown>
	getUserAchievements(request: RawRequest): Promise<unknown>
}

type AchievementsApiConstructor = new (
	config: typeof KH_API_CONFIG,
) => GeneratedAchievementsApiClient

const GeneratedAchievementsApi = (
	KhronosApiClient as unknown as {
		AchievementsApi?: AchievementsApiConstructor
	}
).AchievementsApi

/** True when the installed generated client ships `AchievementsApi`. */
export const isAchievementsApiAvailable = (): boolean =>
	Boolean(GeneratedAchievementsApi)

/**
 * Generated-client wrapper for Khronos achievements. Achievements are
 * cosmetic: no currency, no streaks.
 */
export default class AchievementsWrapper implements AchievementsApiClient {
	private readonly api: GeneratedAchievementsApiClient

	constructor(client?: AchievementsApiClient) {
		if (client) {
			this.api = {
				evaluateUserAchievements: ({ userId }) =>
					client.evaluateUserAchievements(userId),
				getUserAchievements: ({ userId }) =>
					client.getUserAchievements(userId),
			}
			return
		}

		if (!GeneratedAchievementsApi) {
			throw new Error(
				'Khronos AchievementsApi is unavailable; update @pluto-khronos/api-client to the achievements release before enabling /profile',
			)
		}

		this.api = new GeneratedAchievementsApi(KH_API_CONFIG)
	}

	/** Awards any newly earned achievements, then returns the full state. */
	async evaluateUserAchievements(
		userId: string,
	): Promise<UserAchievementsDto> {
		const request = { userId }
		const raw = this.api.evaluateUserAchievementsRaw
		return await this.read(
			raw
				? async () => (await raw.call(this.api, request)).raw.json()
				: () => this.api.evaluateUserAchievements(request),
		)
	}

	/** Read-only view of the current achievements state. */
	async getUserAchievements(userId: string): Promise<UserAchievementsDto> {
		const request = { userId }
		const raw = this.api.getUserAchievementsRaw
		return await this.read(
			raw
				? async () => (await raw.call(this.api, request)).raw.json()
				: () => this.api.getUserAchievements(request),
		)
	}

	private async read(load: () => Promise<unknown>) {
		const body = await pTimeout(load(), {
			milliseconds: DEFAULT_TIMEOUT_MS,
		})
		return parseUserAchievements(body)
	}
}
