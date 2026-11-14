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
