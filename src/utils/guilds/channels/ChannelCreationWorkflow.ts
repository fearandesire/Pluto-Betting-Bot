import { randomUUID } from 'node:crypto'
import type {
	ChannelIntent,
	ChannelReservation,
	ChannelReservationStore,
} from '../../cache/queue/channel-reservation-store.js'

export interface CreatedChannel {
	channelId: string
	complete(): Promise<void>
}

export interface ChannelCreationDiscordPort {
	findByMarker(intent: ChannelIntent): Promise<{ id: string } | null>
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

export class ChannelCreationWorkflow {
	constructor(private readonly ports: ChannelCreationPorts) {}

	async run(intent: ChannelIntent): Promise<ChannelCreationOutcome> {
		const owner = cryptoRandomOwner()
		const reservation = await this.ports.reservations.reserve(intent, owner)
		if (reservation.state === 'created') {
			const existing = await this.ports.discord.findByMarker(intent)
			if (existing && this.ports.discord.completeExisting) {
				await this.ports.discord.completeExisting(intent, existing.id)
			}
			return {
				state: 'already-created',
				channelId: reservation.channelId,
			}
		}
		if (reservation.state === 'busy') return { state: 'busy' }

		let created: CreatedChannel | undefined
		let recorded = false
		const stopRenewal = this.startRenewal(intent, owner)
		try {
			const existing = await this.ports.discord.findByMarker(intent)
			if (existing) {
				await this.recordIfOwned(intent, owner, existing.id)
				return { state: 'reconciled', channelId: existing.id }
			}

			created = await this.ports.discord.create(intent)
			await this.recordIfOwned(intent, owner, created.channelId)
			recorded = true
			await created.complete()
			return { state: 'created', channelId: created.channelId }
		} catch (error) {
			if (created && recorded) throw error
			const existing = await this.ports.discord.findByMarker(intent)
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

	private startRenewal(intent: ChannelIntent, owner: string): () => void {
		if (!this.ports.reservations.refresh) return () => undefined
		const timer = setInterval(() => {
			void this.ports.reservations?.refresh?.(intent, owner)
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

function cryptoRandomOwner(): string {
	return randomUUID()
}
