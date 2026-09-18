import type {
	AlertIncidentStore,
	AlertObservation,
	AlertRecovery,
	StoredAlertTransition,
} from './alert-reporter.js'

interface AlertRedis {
	get(key: string): Promise<string | null>
	set(
		key: string,
		value: string,
		...options: Array<string | number>
	): Promise<'OK' | null>
	transitionIfValue(
		key: string,
		expectedValue: string,
		nextValue: string,
		seconds?: number,
	): Promise<boolean>
}

interface StoredIncident {
	state: 'firing' | 'resolved'
	firstFiredAt: string
	lastNotifiedAt?: string
	resolvedAt?: string
	suppressedCount: number
}

const KEY_PREFIX = 'pluto:alert:v1:'
const RETENTION_SECONDS = 180 * 24 * 60 * 60
const REMINDER_SECONDS = 6 * 60 * 60

export class RedisAlertIncidentStore implements AlertIncidentStore {
	constructor(
		private readonly redis: AlertRedis,
		private readonly reminderSeconds = REMINDER_SECONDS,
	) {}

	async recordFiring(
		input: AlertObservation,
	): Promise<StoredAlertTransition> {
		const key = incidentKey(input)
		for (let attempt = 0; attempt < 8; attempt++) {
			const raw = await this.redis.get(key)
			const current = parse(raw)
			if (!current || current.state === 'resolved') {
				const next: StoredIncident = {
					state: 'firing',
					firstFiredAt: input.observedAt.toISOString(),
					suppressedCount: 0,
				}
				const created = raw
					? await this.redis.transitionIfValue(
							key,
							raw,
							JSON.stringify(next),
							RETENTION_SECONDS,
						)
					: (await this.redis.set(
							key,
							JSON.stringify(next),
							'EX',
							RETENTION_SECONDS,
							'NX',
						)) === 'OK'
				if (created) {
					return {
						state: 'firing',
						firstFiredAt: input.observedAt,
						suppressedCount: 0,
						emit: true,
					}
				}
				continue
			}

			const firstFiredAt = new Date(current.firstFiredAt)
			const lastNotifiedAt = current.lastNotifiedAt
				? new Date(current.lastNotifiedAt)
				: firstFiredAt
			const shouldRemind =
				input.observedAt.getTime() - lastNotifiedAt.getTime() >=
				this.reminderSeconds * 1000
			const next: StoredIncident = {
				...current,
				suppressedCount:
					current.suppressedCount + (shouldRemind ? 0 : 1),
				lastNotifiedAt: shouldRemind
					? input.observedAt.toISOString()
					: current.lastNotifiedAt,
			}
			if (
				raw &&
				(await this.redis.transitionIfValue(
					key,
					raw,
					JSON.stringify(next),
					RETENTION_SECONDS,
				))
			) {
				return {
					state: 'firing',
					firstFiredAt,
					suppressedCount: next.suppressedCount,
					emit: shouldRemind,
				}
			}
		}
		throw new Error('Could not atomically update alert incident')
	}

	async resolve(input: AlertRecovery): Promise<StoredAlertTransition | null> {
		const key = incidentKey(input)
		for (let attempt = 0; attempt < 8; attempt++) {
			const raw = await this.redis.get(key)
			const current = parse(raw)
			if (!raw || !current || current.state === 'resolved') return null
			const next: StoredIncident = {
				...current,
				state: 'resolved',
				resolvedAt: input.resolvedAt.toISOString(),
			}
			if (
				await this.redis.transitionIfValue(
					key,
					raw,
					JSON.stringify(next),
					RETENTION_SECONDS,
				)
			) {
				return {
					state: 'resolved',
					firstFiredAt: new Date(current.firstFiredAt),
					resolvedAt: input.resolvedAt,
					suppressedCount: current.suppressedCount,
					emit: true,
				}
			}
		}
		return null
	}
}

function incidentKey(input: AlertObservation): string {
	return `${KEY_PREFIX}${input.key}:${normalizeScope(input.scope)}`
}

function normalizeScope(scope: string): string {
	return (
		scope
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9_-]+/g, '_') || 'global'
	)
}

function parse(value: string | null): StoredIncident | null {
	if (!value) return null
	try {
		const parsed = JSON.parse(value) as StoredIncident
		if (
			(parsed.state !== 'firing' && parsed.state !== 'resolved') ||
			typeof parsed.firstFiredAt !== 'string' ||
			!validDate(parsed.firstFiredAt) ||
			(parsed.resolvedAt !== undefined &&
				!validDate(parsed.resolvedAt)) ||
			!Number.isSafeInteger(parsed.suppressedCount) ||
			parsed.suppressedCount < 0
		)
			return null
		return parsed
	} catch {
		return null
	}
}

function validDate(value: string): boolean {
	return Number.isFinite(new Date(value).getTime())
}
