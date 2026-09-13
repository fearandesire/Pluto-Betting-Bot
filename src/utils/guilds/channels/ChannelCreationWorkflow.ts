import { randomUUID } from 'node:crypto'
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

export class ChannelCreationWorkflow {
	constructor(private readonly ports: ChannelCreationPorts) {}

	async run(intent: ChannelIntent): Promise<ChannelCreationOutcome> {
		const owner = cryptoRandomOwner()
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

		let created: CreatedChannel | undefined
		let recorded = false
		let leaseLost = false
		const stopRenewal = this.startRenewal(intent, owner, () => {
			leaseLost = true
		})
		try {
			const existing = await this.ports.discord.findByMarker(intent)
			if (leaseLost) throw new Error('Channel creation lease was lost')
			if (existing) {
				await this.recordIfOwned(intent, owner, existing.id)
				return { state: 'reconciled', channelId: existing.id }
			}

			if (leaseLost) throw new Error('Channel creation lease was lost')
			if (this.ports.reservations.refresh) {
				try {
					const renewed = await this.ports.reservations.refresh(
						intent,
						owner,
					)
					if (!renewed) {
						leaseLost = true
						throw new Error('Channel creation lease was lost')
					}
				} catch (error) {
					if (
						error instanceof Error &&
						error.message.includes('lease')
					)
						throw error
					logLeaseError('verification', error)
				}
			}
			created = await this.ports.discord.create(intent)
			await this.recordIfOwned(intent, owner, created.channelId)
			recorded = true
			await created.complete()
			return { state: 'created', channelId: created.channelId }
		} catch (error) {
			if (created && recorded) throw error
			if (leaseLost) {
				await this.ports.reservations
					.release(intent, owner)
					.catch((releaseError) =>
						logLeaseError('release', releaseError),
					)
				throw error
			}
			let existing: { id: string } | null
			try {
				existing = await this.ports.discord.findByMarker(intent)
			} catch {
				await this.ports.reservations
					.release(intent, owner)
					.catch((releaseError) =>
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
			await this.ports.reservations.release(intent, owner)
			throw error
		} finally {
			stopRenewal()
		}
	}

	private startRenewal(
		intent: ChannelIntent,
		owner: string,
		onLeaseLost?: () => void,
	): () => void {
		if (!this.ports.reservations.refresh) return () => undefined
		const timer = setInterval(() => {
			void this.ports.reservations
				.refresh?.(intent, owner)
				.then((renewed) => {
					if (!renewed) onLeaseLost?.()
				})
				.catch((error) => logLeaseError('renewal', error))
		}, 60_000)
		return () => clearInterval(timer)
	}

	private async recordIfOwned(
		intent: ChannelIntent,
		owner: string,
		channelId: string,
	): Promise<void> {
		await this.ports.reservations.recordCreated(intent, owner, channelId)
	}
}

function logLeaseError(operation: string, error: unknown): void {
	logger.warn({
		event: 'channel_creation.reservation_operation_failed',
		operation,
		error: error instanceof Error ? error.name : 'unknown',
	})
}

function cryptoRandomOwner(): string {
	return randomUUID()
}
