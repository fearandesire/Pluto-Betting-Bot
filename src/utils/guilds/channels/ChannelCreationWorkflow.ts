import { randomUUID } from 'node:crypto'
import { registerShutdownQueue } from '../../../lib/startup/shutdown-registry.js'
import type {
	ChannelIntent,
	ChannelReservation,
	ChannelReservationStore,
} from '../../cache/queue/channel-reservation-store.js'
import { logger } from '../../logging/WinstonLogger.js'

export interface CreatedChannel {
	channelId: string
	complete(): Promise<void>
}

export interface ChannelCreationDiscordPort {
	findByMarker(
		intent: ChannelIntent,
		knownChannelId?: string,
	): Promise<{ id: string } | null>
	completeExisting?(intent: ChannelIntent, channelId: string): Promise<void>
	create(intent: ChannelIntent): Promise<CreatedChannel>
}

export interface ChannelCreationPorts {
	reservations: ChannelReservationStore
	discord: ChannelCreationDiscordPort
}

export type ChannelCreationOutcome =
	| { state: 'created'; channelId: string }
	| { state: 'already-created'; channelId: string }
	| { state: 'reconciled'; channelId: string }
	| { state: 'busy' }

export class ChannelCreationBusyError extends Error {
	readonly retryAfterMs = 5 * 60 * 1000

	constructor() {
		super('Channel creation reservation is busy')
	}
}

export class LeaseLostError extends Error {
	readonly code = 'CHANNEL_CREATION_LEASE_LOST'

	constructor() {
		super('Channel creation lease was lost')
		this.name = 'LeaseLostError'
	}
}

export const CHANNEL_CREATION_LEASE_RELEASE_TIMEOUT_MS = 2_000
const CHANNEL_CREATION_IN_FLIGHT_WAIT_TIMEOUT_MS = 1_500
const CHANNEL_CREATION_LEASE_TTL_MS = 5 * 60 * 1000

interface ActiveLease {
	intent: ChannelIntent
	expiryTimer: ReturnType<typeof setTimeout>
}

interface ActiveRun {
	intent: ChannelIntent
	settled: boolean
	settledPromise: Promise<void>
}

export class ChannelCreationWorkflow {
	private readonly shutdownName = `channel-creation-lease:${randomUUID()}`
	private unregisterShutdownQueue?: () => void
	private readonly activeRuns = new Map<string, ActiveRun>()
	private readonly activeLeases = new Map<string, ActiveLease>()
	private readonly activeRenewals = new Map<string, () => void>()
	private readonly leaveLeaseToExpire = new Set<string>()
	private shuttingDown = false

	constructor(private readonly ports: ChannelCreationPorts) {
		this.registerShutdownQueue()
	}

	async run(intent: ChannelIntent): Promise<ChannelCreationOutcome> {
		const owner = cryptoRandomOwner()
		this.registerShutdownQueue()
		let resolveSettled!: () => void
		const activeRun: ActiveRun = {
			intent,
			settled: false,
			settledPromise: new Promise((resolve) => {
				resolveSettled = resolve
			}),
		}
		this.activeRuns.set(owner, activeRun)
		const execution = this.execute(intent, owner)
		try {
			return await execution
		} finally {
			activeRun.settled = true
			resolveSettled()
			this.activeRuns.delete(owner)
			this.maybeUnregisterShutdownQueue()
		}
	}

	private async execute(
		intent: ChannelIntent,
		owner: string,
	): Promise<ChannelCreationOutcome> {
		const reservation = await this.ports.reservations.reserve(intent, owner)
		if (reservation.state === 'created') {
			const existing = await this.ports.discord.findByMarker(
				intent,
				reservation.channelId,
			)
			if (existing && this.ports.discord.completeExisting) {
				await this.ports.discord.completeExisting(intent, existing.id)
			}
			if (existing) {
				return {
					state: 'already-created',
					channelId: reservation.channelId,
				}
			}
			const reclaimed = await this.ports.reservations.reclaimCreated?.(
				intent,
				reservation.channelId,
				owner,
			)
			if (!reclaimed) return { state: 'busy' }
		}
		if (reservation.state === 'busy') return { state: 'busy' }

		this.trackLease(intent, owner)
		let created: CreatedChannel | undefined
		let recorded = false
		let leaseLost = false
		const stopRenewal = this.startRenewal(intent, owner, () => {
			leaseLost = true
		})
		this.activeRenewals.set(owner, stopRenewal)
		try {
			const existing = await this.ports.discord.findByMarker(intent)
			if (leaseLost) throw new LeaseLostError()
			if (existing) {
				await this.recordIfOwned(intent, owner, existing.id)
				return { state: 'reconciled', channelId: existing.id }
			}

			if (leaseLost) throw new LeaseLostError()
			if (this.ports.reservations.refresh) {
				try {
					const renewed = await this.ports.reservations.refresh(
						intent,
						owner,
					)
					if (!renewed) {
						leaseLost = true
						throw new LeaseLostError()
					}
				} catch (error) {
					if (error instanceof LeaseLostError) throw error
					leaseLost = true
					logLeaseError('verification', error)
					throw new LeaseLostError()
				}
			}
			if (leaseLost) throw new LeaseLostError()
			created = await this.ports.discord.create(intent)
			await this.recordIfOwned(intent, owner, created.channelId)
			recorded = true
			await created.complete()
			return { state: 'created', channelId: created.channelId }
		} catch (error) {
			if (created && recorded) throw error
			if (leaseLost) {
				await this.releaseLease(intent, owner).catch((releaseError) =>
					logLeaseError('release', releaseError),
				)
				throw error
			}
			let existing: { id: string } | null
			try {
				existing = await this.ports.discord.findByMarker(intent)
			} catch {
				await this.releaseLease(intent, owner).catch((releaseError) =>
					logLeaseError('release', releaseError),
				)
				throw error
			}
			if (existing) {
				await this.recordIfOwned(intent, owner, existing.id)
				if (this.ports.discord.completeExisting) {
					await this.ports.discord.completeExisting(
						intent,
						existing.id,
					)
				}
				return { state: 'reconciled', channelId: existing.id }
			}
			await this.releaseLease(intent, owner)
			throw error
		} finally {
			this.stopRenewal(owner)
		}
	}

	async close(): Promise<void> {
		if (this.shuttingDown) return
		this.shuttingDown = true
		const deadline = Date.now() + CHANNEL_CREATION_LEASE_RELEASE_TIMEOUT_MS
		for (const owner of this.activeRenewals.keys()) this.stopRenewal(owner)

		try {
			const activeRuns = [...this.activeRuns]
			if (activeRuns.length > 0) {
				// Queue drain can continue for 30s; lease cleanup waits only 1.5s
				// so release attempts retain part of the 2s shutdown budget.
				const waitDeadline = Math.min(
					deadline,
					Date.now() + CHANNEL_CREATION_IN_FLIGHT_WAIT_TIMEOUT_MS,
				)
				let timeout: ReturnType<typeof setTimeout> | undefined
				try {
					await Promise.race([
						Promise.all(
							activeRuns.map(([, run]) => run.settledPromise),
						),
						new Promise<void>((resolve) => {
							timeout = setTimeout(
								resolve,
								remainingMs(waitDeadline),
							)
						}),
					])
				} finally {
					if (timeout) clearTimeout(timeout)
				}
			}

			for (const [owner, run] of activeRuns) {
				if (!run.settled) {
					const lease = this.activeLeases.get(owner)
					if (lease) {
						this.leaveLeaseToExpire.add(owner)
						this.removeLease(owner)
						logLeaseLeftToExpire(lease.intent)
					} else {
						logInFlightTimeout(run.intent)
					}
				} else {
					logWaitedForInFlight(run.intent)
				}
			}

			const releases = [...this.activeLeases].map(
				async ([owner, lease]) => {
					const timeoutMs = remainingMs(deadline)
					if (timeoutMs <= 0) {
						this.removeLease(owner)
						logLeaseLeftToExpire(lease.intent)
						return
					}
					try {
						await withTimeout(
							this.releaseLease(lease.intent, owner),
							timeoutMs,
						)
					} catch {
						this.removeLease(owner)
						logLeaseLeftToExpire(lease.intent)
					}
				},
			)
			await Promise.all(releases)
		} finally {
			this.unregisterShutdownQueue?.()
			this.unregisterShutdownQueue = undefined
		}
	}

	private startRenewal(
		intent: ChannelIntent,
		owner: string,
		onLeaseLost?: () => void,
	): () => void {
		if (this.shuttingDown || !this.ports.reservations.refresh)
			return () => undefined
		const timer = setInterval(() => {
			void this.ports.reservations
				.refresh?.(intent, owner)
				.then((renewed) => {
					if (!renewed) onLeaseLost?.()
				})
				.catch((error) => {
					onLeaseLost?.()
					logLeaseError('renewal', error)
				})
		}, 60_000)
		return () => clearInterval(timer)
	}

	private trackLease(intent: ChannelIntent, owner: string): ActiveLease {
		const expiryTimer = setTimeout(() => {
			this.removeLease(owner)
		}, CHANNEL_CREATION_LEASE_TTL_MS)
		expiryTimer.unref?.()
		const lease = {
			intent,
			expiryTimer,
		}
		this.activeLeases.set(owner, lease)
		if (this.shuttingDown) {
			this.leaveLeaseToExpire.add(owner)
			logLeaseLeftToExpire(intent)
		}
		return lease
	}

	private async releaseLease(
		intent: ChannelIntent,
		owner: string,
	): Promise<boolean> {
		if (this.leaveLeaseToExpire.has(owner)) {
			this.removeLease(owner)
			return false
		}
		const released = await this.ports.reservations.release(intent, owner)
		this.removeLease(owner)
		return released
	}

	private stopRenewal(owner: string): void {
		const stopRenewal = this.activeRenewals.get(owner)
		if (!stopRenewal) return
		this.activeRenewals.delete(owner)
		stopRenewal()
	}

	private removeLease(owner: string): void {
		const lease = this.activeLeases.get(owner)
		if (lease) clearTimeout(lease.expiryTimer)
		this.activeLeases.delete(owner)
		this.maybeUnregisterShutdownQueue()
	}

	private registerShutdownQueue(): void {
		if (!this.unregisterShutdownQueue && !this.shuttingDown) {
			this.unregisterShutdownQueue = registerShutdownQueue(
				this.shutdownName,
				this,
			)
		}
	}

	private maybeUnregisterShutdownQueue(): void {
		if (
			!this.shuttingDown &&
			this.activeRuns.size === 0 &&
			this.activeLeases.size === 0 &&
			this.activeRenewals.size === 0
		) {
			this.unregisterShutdownQueue?.()
			this.unregisterShutdownQueue = undefined
		}
	}

	private async recordIfOwned(
		intent: ChannelIntent,
		owner: string,
		channelId: string,
	): Promise<void> {
		await this.ports.reservations.recordCreated(intent, owner, channelId)
		this.stopRenewal(owner)
		this.removeLease(owner)
	}
}

function logLeaseError(operation: string, error: unknown): void {
	logger.warn({
		event: 'channel_creation.reservation_operation_failed',
		operation,
		error: error instanceof Error ? error.name : 'unknown',
	})
}

function logLeaseLeftToExpire(intent: ChannelIntent): void {
	logger.warn({
		message: 'lease left to expire',
		channelKey: intent.marker,
	})
}

function logWaitedForInFlight(intent: ChannelIntent): void {
	logger.warn({
		message: 'waited for in-flight creation',
		channelKey: intent.marker,
	})
}

function logInFlightTimeout(intent: ChannelIntent): void {
	logger.warn({
		message: 'in-flight creation exceeded shutdown budget',
		channelKey: intent.marker,
	})
}

function remainingMs(deadline: number): number {
	return Math.max(0, deadline - Date.now())
}

async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
): Promise<T> {
	let timeout: ReturnType<typeof setTimeout> | undefined
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, reject) => {
				timeout = setTimeout(
					() => reject(new Error('lease release timed out')),
					timeoutMs,
				)
			}),
		])
	} finally {
		if (timeout) clearTimeout(timeout)
	}
}

function cryptoRandomOwner(): string {
	return randomUUID()
}
