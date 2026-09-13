import { type AlertState, buildAlertEvent } from './alert-event.js'

export type PlutoAlertKey =
	| 'delivery.failed'
	| 'khronos.unreachable'
	| 'gateway.disconnected'
	| 'discord.rate_limited'

export interface AlertObservation {
	key: PlutoAlertKey
	scope: string
	severity: 'info' | 'warning' | 'critical'
	title: string
	summary: string
	retriable: boolean
	observedAt: Date
	context?: Record<string, string | number | boolean | null>
}

export interface AlertRecovery extends AlertObservation {
	resolvedAt: Date
}

export interface StoredAlertTransition {
	state: AlertState
	firstFiredAt: Date
	resolvedAt?: Date
	suppressedCount?: number
	emit: boolean
}

export interface AlertIncidentStore {
	recordFiring(input: AlertObservation): Promise<StoredAlertTransition>
	resolve(input: AlertRecovery): Promise<StoredAlertTransition | null>
}

let defaultReporter: Pick<AlertReporter, 'firing' | 'resolved'> | undefined

export function setDefaultAlertReporter(
	reporter: Pick<AlertReporter, 'firing' | 'resolved'>,
): void {
	defaultReporter = reporter
}

export function getDefaultAlertReporter():
	| Pick<AlertReporter, 'firing' | 'resolved'>
	| undefined {
	return defaultReporter
}

interface AlertLogger {
	info(meta: Record<string, unknown>): unknown
	warn(meta: Record<string, unknown>): unknown
}

type EmittedTransition = {
	state: AlertState
	firstFiredAt: Date
	resolvedAt?: Date
	suppressedCount?: number
}

export class AlertReporter {
	constructor(
		private readonly store: AlertIncidentStore,
		private readonly logger: AlertLogger,
		private readonly config: { version: string; environment: string },
	) {}

	async firing(input: AlertObservation): Promise<void> {
		const transition = await this.store.recordFiring(input)
		if (!transition.emit) return
		this.emit(input, {
			state: 'firing',
			firstFiredAt: transition.firstFiredAt,
			suppressedCount: transition.suppressedCount,
		})
	}

	async resolved(input: AlertRecovery): Promise<void> {
		const transition = await this.store.resolve(input)
		if (!transition?.emit) return
		this.emit(input, {
			state: 'resolved',
			firstFiredAt: transition.firstFiredAt,
			resolvedAt: transition.resolvedAt ?? input.resolvedAt,
			suppressedCount: transition.suppressedCount,
		})
	}

	private emit(input: AlertObservation, transition: EmittedTransition): void {
		try {
			const event = buildAlertEvent(
				{
					state: transition.state,
					key: input.key,
					scope: input.scope,
					severity: input.severity,
					title: input.title,
					summary: input.summary,
					firedAt: transition.firstFiredAt,
					resolvedAt: transition.resolvedAt,
					suppressedCount: transition.suppressedCount,
					context: input.context,
				},
				this.config,
			)
			this.logger.info({ event: 'alert.transition', alert_event: event })
		} catch (error) {
			this.logger.warn({
				event: 'alert.transition_rejected',
				alert_key: input.key,
				error: error instanceof Error ? error.name : 'unknown',
			})
		}
	}
}
