import { accent, text, v2Payload } from '../../lib/discord/v2/kit.js'
import { logger } from '../../utils/logging/WinstonLogger.js'

/** A key alerts at most once per window; repeats are counted and reported with the next alert. */
export const BETTING_OPS_DEDUPE_MS = 10 * 60_000
const POST_TIMEOUT_MS = 3_000
const MAX_TRACKED_KEYS = 500
const MAX_ERROR_CHARS = 200

export type BettingOpsEvent =
	| 'command.failed'
	| 'interaction.expired_before_ack'
	| 'bet.placement_failed'
	| 'khronos.betting_unavailable'

export interface BettingOpsFailure {
	/** Dedupe key. Two failures with the same key share one alert window. */
	key: string
	event: BettingOpsEvent
	command?: string
	guildId?: string | null
	channelId?: string | null
	userId?: string | null
	requestId?: string | null
	error: unknown
}

/** A short, single-line description. URLs are removed so a webhook or API address never reaches the channel. */
export function describeError(error: unknown): string {
	const raw =
		error instanceof Error
			? `${error.name}: ${error.message}`
			: String(error)
	return raw.replace(/https?:\/\/\S+/g, '[url]').slice(0, MAX_ERROR_CHARS)
}

/** Components V2 payload, so the alert follows the repo's message rules. */
export function buildPayload(
	failure: BettingOpsFailure,
	suppressed: number,
	version: string,
	at: Date,
) {
	const rows: [string, string][] = [
		['Event', failure.event],
		['Command', failure.command ? `/${failure.command}` : 'n/a'],
		['Guild', failure.guildId ?? 'n/a'],
		['Channel', failure.channelId ?? 'n/a'],
		['User', failure.userId ?? 'n/a'],
		['Request', failure.requestId ?? 'n/a'],
		['Error', `\`${describeError(failure.error)}\``],
	]
	if (suppressed > 0) {
		rows.push(['Suppressed', `${suppressed} repeat(s) in the last 10 min`])
	}
	const body = rows.map(([name, value]) => `**${name}:** ${value}`).join('\n')
	return {
		username: 'Pluto ops',
		...v2Payload({
			accent: accent('error'),
			blocks: [
				text(`**Critical betting failure**\n${body}`),
				text(`-# service=pluto · ${version} · ${at.toISOString()}`),
			],
		}),
	}
}

export interface BettingOpsAlerterOptions {
	url: string
	version: string
	fetch?: typeof fetch
	now?: () => number
	timeoutMs?: number
}

export interface BettingOpsAlerter {
	report(failure: BettingOpsFailure): void
}

interface Slot {
	lastSentAt: number
	suppressed: number
}

/**
 * Posts critical betting failures to a Discord webhook. `report` never throws
 * and never waits: the post runs in the background with a timeout, so an
 * unreachable webhook cannot slow command handling.
 */
export function createBettingOpsAlerter(
	options: BettingOpsAlerterOptions,
): BettingOpsAlerter {
	const send = options.fetch ?? fetch
	const now = options.now ?? Date.now
	const timeoutMs = options.timeoutMs ?? POST_TIMEOUT_MS
	const slots = new Map<string, Slot>()

	const post = async (failure: BettingOpsFailure, suppressed: number) => {
		const response = await send(options.url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(
				buildPayload(
					failure,
					suppressed,
					options.version,
					new Date(now()),
				),
			),
			signal: AbortSignal.timeout(timeoutMs),
		})
		if (!response.ok) {
			logger.warn('Betting ops alert was rejected', {
				event: 'betting_ops.alert_failed',
				status: response.status,
				alertEvent: failure.event,
			})
		}
	}

	const prune = (t: number) => {
		if (slots.size <= MAX_TRACKED_KEYS) return
		for (const [key, slot] of slots) {
			if (t - slot.lastSentAt >= BETTING_OPS_DEDUPE_MS) slots.delete(key)
		}
	}

	return {
		report(failure) {
			try {
				const t = now()
				const slot = slots.get(failure.key)
				if (slot && t - slot.lastSentAt < BETTING_OPS_DEDUPE_MS) {
					slot.suppressed += 1
					return
				}
				const suppressed = slot?.suppressed ?? 0
				prune(t)
				slots.set(failure.key, { lastSentAt: t, suppressed: 0 })
				post(failure, suppressed).catch((error: unknown) => {
					logger.warn('Betting ops alert failed to post', {
						event: 'betting_ops.alert_failed',
						error: error instanceof Error ? error.name : 'unknown',
						alertEvent: failure.event,
					})
				})
			} catch (error) {
				logger.warn('Betting ops alert could not be queued', {
					event: 'betting_ops.alert_failed',
					error: error instanceof Error ? error.name : 'unknown',
				})
			}
		},
	}
}

/**
 * The configured alerter, loaded on first use. `env` is imported lazily so
 * modules that only report failures do not parse the whole environment at
 * import time. Unset URL means a no-op. The URL is never logged.
 */
let configured: Promise<BettingOpsAlerter | null> | undefined

const loadAlerter = (): Promise<BettingOpsAlerter | null> => {
	configured ??= import('../../lib/startup/env.js').then(
		({ default: env }) =>
			env.BETTING_OPS_WEBHOOK_URL
				? createBettingOpsAlerter({
						url: env.BETTING_OPS_WEBHOOK_URL,
						version: env.PROJECT_VERSION,
					})
				: null,
	)
	return configured
}

/** Fire-and-forget. Never throws and never blocks the caller. */
export function reportBettingFailure(failure: BettingOpsFailure): void {
	loadAlerter()
		.then((alerter) => alerter?.report(failure))
		.catch(() => {
			// Alerting must never break command handling.
		})
}
