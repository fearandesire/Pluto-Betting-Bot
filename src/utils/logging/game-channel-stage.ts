import { logger } from './WinstonLogger.js'

export type GameChannelStage = 'created' | 'posted' | 'deleted'
export type GameChannelOutcome =
	| 'ok'
	| 'skipped'
	| 'held'
	| 'duplicate'
	| 'deferred'
	| 'failed'
	| 'retrying'

export interface GameChannelStageEvent {
	stage: GameChannelStage
	outcome: GameChannelOutcome
	/** Short snake_case code. Never an error message. */
	reason: string
	gameId?: unknown
	sport?: unknown
	guildId?: string
	attempt?: number
	/** Only for deletes, which Khronos addresses by name rather than game id. */
	channelName?: string
}

const GAME_ID = /^[0-9a-f]{32}$/

/** The Goracle event id as 32 lowercase hex, or undefined when the input is not one. */
export function canonicalGameId(raw: unknown): string | undefined {
	if (typeof raw !== 'string') return undefined
	const id = raw.replaceAll('-', '').toLowerCase()
	return GAME_ID.test(id) ? id : undefined
}

export function gameChannelSport(raw: unknown): 'nba' | 'nfl' | undefined {
	if (typeof raw !== 'string') return undefined
	const sport = raw.toLowerCase()
	if (sport.includes('nba')) return 'nba'
	if (sport.includes('nfl')) return 'nfl'
	return undefined
}

const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/

/** The id as given when it is a short safe string, else undefined. Never throws. */
export function safeRequestId(raw: unknown): string | undefined {
	return typeof raw === 'string' && REQUEST_ID.test(raw) ? raw : undefined
}

const fieldOf = (value: unknown, key: string): unknown =>
	typeof value === 'object' && value !== null
		? (value as Record<string, unknown>)[key]
		: undefined

/** Channel creation jobs carry Khronos' id in `metadata.requestId`. */
export const creationJobRequestId = (job: { data?: unknown }) =>
	safeRequestId(fieldOf(fieldOf(job.data, 'metadata'), 'requestId'))

/** Deletion and presentation-update jobs carry it at the top level of the payload. */
export const topLevelJobRequestId = (job: { data?: unknown }) =>
	safeRequestId(fieldOf(job.data, 'requestId'))

type StageFailure = Pick<
	GameChannelStageEvent,
	'stage' | 'reason' | 'gameId' | 'sport' | 'guildId'
>

const STAGE_FAILURE = Symbol('gameChannelStageFailure')

/**
 * Records which stage a thrown error broke, so the one place that reports the
 * failure (the queue worker or the route) names that stage instead of guessing.
 * The first tag wins: the innermost code knows the stage best.
 */
export function tagStageFailure<E>(error: E, failure: StageFailure): E {
	if (
		typeof error === 'object' &&
		error !== null &&
		!(STAGE_FAILURE in error)
	)
		Object.defineProperty(error, STAGE_FAILURE, { value: failure })
	return error
}

export function stageFailureOf(error: unknown): StageFailure | undefined {
	return typeof error === 'object' && error !== null
		? (error as { [STAGE_FAILURE]?: StageFailure })[STAGE_FAILURE]
		: undefined
}

const LEVEL = {
	failed: 'error',
	retrying: 'warn',
} as const

/**
 * One line per game per stage, so an operator can grep `game_channel.stage`
 * and see whether a game got a channel and a post. Carries ids and codes only.
 */
export function logGameChannelStage(event: GameChannelStageEvent): void {
	const level =
		event.outcome === 'failed' || event.outcome === 'retrying'
			? LEVEL[event.outcome]
			: 'info'
	logger[level]({
		message: 'game_channel.stage',
		event: 'game_channel.stage',
		game_id: canonicalGameId(event.gameId),
		sport: gameChannelSport(event.sport),
		stage: event.stage,
		outcome: event.outcome,
		reason: event.reason,
		attempt: event.attempt,
		guild_id: event.guildId,
		channel_name: event.channelName,
		ts: new Date().toISOString(),
	})
}
