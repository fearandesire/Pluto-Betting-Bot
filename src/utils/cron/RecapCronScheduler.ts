import { logger } from '../logging/WinstonLogger.js'
import type { RecapCronService } from './RecapCronService.js'

const POLL_INTERVAL_MS = 30_000

/**
 * Minimal UTC cron matcher for the five-field expression used by RECAP_CRON.
 * Supports literals, comma lists, ranges, and wildcard step values.
 */
export function matchesCronExpression(expression: string, date: Date): boolean {
	const fields = expression.trim().split(/\s+/)
	if (fields.length !== 5) return false

	const [minute, hour, dayOfMonth, month, dayOfWeek] = fields
	return (
		matchesCronField(minute, date.getUTCMinutes(), 0, 59) &&
		matchesCronField(hour, date.getUTCHours(), 0, 23) &&
		matchesCronField(dayOfMonth, date.getUTCDate(), 1, 31) &&
		matchesCronField(month, date.getUTCMonth() + 1, 1, 12) &&
		matchesCronField(dayOfWeek, date.getUTCDay(), 0, 6)
	)
}

function matchesCronField(
	field: string,
	value: number,
	minimum: number,
	maximum: number,
): boolean {
	return field.split(',').some((part) => {
		const [rangePart, stepPart] = part.split('/')
		const step = stepPart ? Number.parseInt(stepPart, 10) : 1
		if (!Number.isInteger(step) || step < 1) return false

		const range = rangePart === '*' ? `${minimum}-${maximum}` : rangePart
		const [startText, endText] = range.includes('-')
			? range.split('-')
			: [range, range]
		const start = Number.parseInt(startText, 10)
		const end = Number.parseInt(endText, 10)
		if (
			!Number.isInteger(start) ||
			!Number.isInteger(end) ||
			start < minimum ||
			end > maximum ||
			start > end
		) {
			return false
		}

		return value >= start && value <= end && (value - start) % step === 0
	})
}

/**
 * Polls the configured UTC cron expression and runs one recap per matching
 * minute. In-memory minute tracking handles the duplicate ticks caused by the
 * 30-second poll interval; Redis deduplication handles process restarts.
 */
export class RecapCronScheduler {
	private interval: NodeJS.Timeout | null = null
	private lastRunMinute: string | null = null

	constructor(
		private readonly recapService: Pick<RecapCronService, 'runWeeklyRecap'>,
		private readonly expression: string,
		private readonly pollIntervalMs = POLL_INTERVAL_MS,
	) {}

	start(): void {
		if (this.interval) return
		this.tick(new Date(), true).catch((error) => {
			logger.error({
				message: 'Weekly recap scheduler startup tick failed',
				metadata: {
					error:
						error instanceof Error ? error.message : String(error),
				},
			})
		})
		this.interval = setInterval(() => {
			this.tick().catch((error) => {
				logger.error({
					message: 'Weekly recap scheduler tick failed',
					metadata: {
						error:
							error instanceof Error
								? error.message
								: String(error),
					},
				})
			})
		}, this.pollIntervalMs)
	}

	async tick(now = new Date(), allowCatchUp = false): Promise<boolean> {
		if (
			!matchesCronExpression(this.expression, now) &&
			!(allowCatchUp && isCronDueToday(this.expression, now))
		) {
			return false
		}
		const minuteKey = now.toISOString().slice(0, 16)
		if (this.lastRunMinute === minuteKey) return false

		this.lastRunMinute = minuteKey
		await this.recapService.runWeeklyRecap(now)
		return true
	}

	stop(): void {
		if (!this.interval) return
		clearInterval(this.interval)
		this.interval = null
	}

	getStatus(): boolean {
		return this.interval !== null
	}
}

/**
 * Treat a bot restart later on the scheduled UTC day as a missed-run catch-up.
 * This keeps the default Monday digest reliable without posting on other days.
 */
function isCronDueToday(expression: string, now: Date): boolean {
	const minute = now.getUTCMinutes()
	const hour = now.getUTCHours()
	for (let candidate = 0; candidate <= hour * 60 + minute; candidate++) {
		const candidateDate = new Date(now)
		candidateDate.setUTCHours(
			Math.floor(candidate / 60),
			candidate % 60,
			0,
			0,
		)
		if (matchesCronExpression(expression, candidateDate)) return true
	}
	return false
}
