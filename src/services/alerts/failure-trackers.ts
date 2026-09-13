import type {
	AlertObservation,
	AlertRecovery,
	AlertReporter,
	PlutoAlertKey,
} from './alert-reporter.js'

interface TrackerConfig {
	key: PlutoAlertKey
	scope: string
	severity: AlertObservation['severity']
	title: string
	summary: string
	threshold: number
	context?: AlertObservation['context']
}

export class ConsecutiveFailureTracker {
	private count = 0
	private firing = false

	constructor(
		private readonly reporter: Pick<AlertReporter, 'firing' | 'resolved'>,
		private readonly config: TrackerConfig,
	) {}

	async failure(): Promise<void> {
		this.count = Math.min(this.count + 1, this.config.threshold)
		if (this.count < this.config.threshold || this.firing) return
		this.firing = true
		await this.reporter.firing(this.observation())
	}

	async success(): Promise<void> {
		const wasFiring = this.firing
		this.count = 0
		this.firing = false
		if (!wasFiring) return
		await this.reporter.resolved({
			...this.observation(),
			resolvedAt: new Date(),
		})
	}

	private observation(): AlertObservation {
		return {
			key: this.config.key,
			scope: this.config.scope,
			severity: this.config.severity,
			title: this.config.title,
			summary: this.config.summary,
			retriable: true,
			observedAt: new Date(),
			context: this.config.context,
		}
	}
}

export class GatewayConnectivityMonitor {
	private readonly timers = new Map<string, ReturnType<typeof setTimeout>>()

	constructor(
		private readonly reporter: Pick<AlertReporter, 'firing' | 'resolved'>,
		private readonly disconnectDelayMs = 2 * 60 * 1000,
	) {}

	disconnected(shardId: string): void {
		if (this.timers.has(shardId)) return
		const timer = setTimeout(() => {
			this.timers.delete(shardId)
			void this.reporter
				.firing({
					key: 'gateway.disconnected',
					scope: `shard_${shardId}`,
					severity: 'critical',
					title: 'Discord gateway disconnected',
					summary:
						'A Discord gateway shard has remained disconnected.',
					retriable: true,
					observedAt: new Date(),
				})
				.catch(() => undefined)
		}, this.disconnectDelayMs)
		this.timers.set(shardId, timer)
	}

	async ready(shardId: string): Promise<void> {
		const timer = this.timers.get(shardId)
		if (timer) clearTimeout(timer)
		this.timers.delete(shardId)
		await this.reporter.resolved({
			key: 'gateway.disconnected',
			scope: `shard_${shardId}`,
			severity: 'critical',
			title: 'Discord gateway recovered',
			summary: 'The Discord gateway shard is connected again.',
			retriable: true,
			observedAt: new Date(),
			resolvedAt: new Date(),
		})
	}
}
