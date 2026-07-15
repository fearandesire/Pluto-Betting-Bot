import { type Job, Queue, Worker } from 'bullmq'
import {
	classifyDeliveryError,
	type DeliveryEnvelope,
	type DeliveryRecord,
	type DestinationState,
	deliveryReceipts,
	hasExactPropPostReceipts,
} from './delivery-contract.js'
import {
	type DeliveryStore,
	deriveDeliveryState,
	RedisDeliveryStore,
} from './delivery-store.js'
import type NotificationService from './notifications.service.js'

export const NOTIFICATION_DELIVERY_QUEUE = 'notification-delivery-v1'

// Keep queue construction lazy and environment-only. Importing notification
// routes in unit tests must not force Pluto's full startup env schema.
const REDIS_CONFIG = {
	host: process.env.R_HOST ?? '127.0.0.1',
	port: Number(process.env.R_PORT ?? 6379),
	password: process.env.R_PASS,
}

export interface DeliveryDispatcher {
	deliver(envelope: DeliveryEnvelope, destinationId: string): Promise<unknown>
}

class DiscordDeliveryDispatcher implements DeliveryDispatcher {
	private service?: NotificationService
	private propPostingHandler?: import('../../../props/PropPostingHandler.js').PropPostingHandler

	private async getService(): Promise<NotificationService> {
		if (!this.service) {
			const module = await import('./notifications.service.js')
			this.service = new module.default()
		}
		return this.service
	}

	async deliver(envelope: DeliveryEnvelope, destinationId: string) {
		if (envelope.kind === 'parlay_result') {
			if (!destinationId.startsWith('dm:'))
				throw new Error(`Invalid parlay destination ${destinationId}`)
			return (await this.getService()).deliverParlayResult(
				envelope.payload,
				envelope.delivery_id,
			)
		}

		if (envelope.kind === 'prop_post') {
			const destination = parsePropPostDestination(destinationId)
			const prop = envelope.payload.props.find(
				(candidate) =>
					candidate.over.outcome_uuid ===
						destination.over_outcome_uuid &&
					candidate.under.outcome_uuid ===
						destination.under_outcome_uuid,
			)
			if (!prop)
				throw new Error(
					`Unknown prop-post destination ${destinationId}`,
				)
			if (!this.propPostingHandler) {
				const module = await import(
					'../../../props/PropPostingHandler.js'
				)
				this.propPostingHandler = new module.PropPostingHandler()
			}
			const receipt = await this.propPostingHandler.postPropPair(
				destination.guild_id,
				destination.channel_id,
				prop,
				prop.sport_title.toLowerCase().includes('nfl') ? 'nfl' : 'nba',
				envelope.delivery_id,
				destinationId,
			)
			if (
				receipt.length !== 2 ||
				receipt.some(
					(reference) =>
						reference.guild_id !== destination.guild_id ||
						reference.channel_id !== destination.channel_id ||
						![
							destination.over_outcome_uuid,
							destination.under_outcome_uuid,
						].includes(reference.outcome_uuid),
				)
			) {
				throw new Error(
					'Prop-post destination returned incomplete receipts',
				)
			}
			return receipt
		}

		const reference = envelope.payload.messages.find(
			(candidate) =>
				`prop:${candidate.guild_id}:${candidate.channel_id}:${candidate.message_id}` ===
				destinationId,
		)
		if (!reference)
			throw new Error(`Unknown prop destination ${destinationId}`)
		return (await this.getService()).deliverPropSettlementMessage(
			envelope.payload,
			reference,
		)
	}
}

class RetryableDeliveryError extends Error {
	readonly retryable = true
}

type DeliveryJob = DeliveryEnvelope

export interface NotificationDeliveryQueueOptions {
	store?: DeliveryStore
	dispatcher?: DeliveryDispatcher
	queue?: DeliveryQueuePort
	startWorker?: boolean
}

export interface DeliveryQueuePort {
	add(
		name: string,
		data: DeliveryJob,
		options: { jobId: string },
	): Promise<unknown>
	close(): Promise<void>
}

export class NotificationDeliveryQueue {
	readonly queue: DeliveryQueuePort
	private readonly worker?: Worker<DeliveryJob>
	private readonly store: DeliveryStore
	private readonly dispatcher: DeliveryDispatcher

	constructor(options: NotificationDeliveryQueueOptions = {}) {
		this.store = options.store ?? new RedisDeliveryStore()
		this.dispatcher = options.dispatcher ?? new DiscordDeliveryDispatcher()
		this.queue =
			options.queue ??
			(new Queue<DeliveryJob>(NOTIFICATION_DELIVERY_QUEUE, {
				connection: REDIS_CONFIG,
				defaultJobOptions: {
					attempts: 8,
					backoff: { type: 'exponential', delay: 60_000 },
					removeOnComplete: { age: 180 * 24 * 60 * 60 },
					removeOnFail: false,
				},
			}) as unknown as DeliveryQueuePort)
		if (options.startWorker !== false) {
			this.worker = new Worker<DeliveryJob>(
				NOTIFICATION_DELIVERY_QUEUE,
				async (job) => this.process(job),
				{
					connection: REDIS_CONFIG,
					concurrency: 8,
					lockDuration: 60_000,
					stalledInterval: 30_000,
				},
			)
			this.worker.on('failed', (job, error) => {
				void import('../../../logging/WinstonLogger.js').then(
					({ logger }) =>
						logger.error({
							method: 'NotificationDeliveryQueue',
							event: 'notification.delivery.job_failed',
							delivery_id: job?.data.delivery_id,
							error: error.message.slice(0, 500),
						}),
				)
			})
		}
	}

	async accept(envelope: DeliveryEnvelope): Promise<DeliveryRecord> {
		return (await this.acceptDetailed(envelope)).record
	}

	async acceptDetailed(
		envelope: DeliveryEnvelope,
	): Promise<{ record: DeliveryRecord; duplicate: boolean }> {
		const accepted = await this.store.accept(envelope)
		if (accepted.kind === 'conflict') {
			const error = new Error(
				'Delivery ID is already used for another payload',
			)
			Object.assign(error, { code: 'DELIVERY_PAYLOAD_MISMATCH' })
			throw error
		}
		if (accepted.kind === 'accepted') {
			try {
				await this.queue.add('deliver', envelope, {
					jobId: envelope.delivery_id,
				})
			} catch (error) {
				await this.store.update(envelope.delivery_id, (record) => ({
					...record,
					state: 'retryable_failed',
				}))
				throw error
			}
		} else if (
			accepted.record.state === 'queued' ||
			accepted.record.state === 'retryable_failed'
		) {
			// Re-enqueue is safe after a worker restart or an ambiguous queue
			// acknowledgement because delivery_id is BullMQ's stable job ID.
			try {
				await this.queue.add('deliver', envelope, {
					jobId: envelope.delivery_id,
				})
			} catch (error) {
				if (!isDuplicateQueueError(error)) throw error
			}
		}
		return {
			record: accepted.record,
			duplicate: accepted.kind === 'duplicate',
		}
	}

	async get(deliveryId: string): Promise<DeliveryRecord | null> {
		return this.store.get(deliveryId)
	}

	private async process(job: Job<DeliveryJob>): Promise<void> {
		const { delivery_id: deliveryId } = job.data
		const record = await this.store.get(deliveryId)
		if (!record) return

		await this.store.update(deliveryId, (current) => ({
			...current,
			state: 'processing',
			attempts: current.attempts + 1,
		}))
		let hasRetryableFailure = false

		for (const destination of record.destinations) {
			if (
				destination.state === 'delivered' ||
				destination.state === 'permanent_failed'
			)
				continue

			await this.store.update(deliveryId, (current) =>
				updateDestination(current, destination.id, {
					state: 'processing',
				}),
			)
			try {
				const receipt = await this.dispatcher.deliver(
					job.data,
					destination.id,
				)
				await this.store.update(deliveryId, (current) =>
					updateDestination(current, destination.id, {
						state: 'delivered',
						receipt,
					}),
				)
			} catch (error) {
				const classified = classifyDeliveryError(error)
				const state: DestinationState =
					classified.classification === 'permanent'
						? 'permanent_failed'
						: 'retryable_failed'
				await this.store.update(deliveryId, (current) =>
					updateDestination(current, destination.id, {
						state,
						last_error: classified.message,
						classification: classified.classification,
					}),
				)
				if (state === 'retryable_failed') hasRetryableFailure = true
			}
		}

		const final = await this.store.update(deliveryId, (current) => {
			const derivedState = deriveDeliveryState(current)
			const propPostComplete =
				current.kind !== 'prop_post' ||
				hasExactPropPostReceipts(
					current.payload as Extract<
						DeliveryEnvelope,
						{ kind: 'prop_post' }
					>['payload'],
					deliveryReceipts(current),
				)
			const state =
				derivedState === 'delivered' && !propPostComplete
					? 'retryable_failed'
					: derivedState
			return {
				...current,
				state,
				delivered_at:
					state === 'delivered'
						? (current.delivered_at ?? new Date().toISOString())
						: current.delivered_at,
			}
		})
		if (hasRetryableFailure || final.state === 'retryable_failed') {
			throw new RetryableDeliveryError(
				'One or more notification destinations require retry',
			)
		}
	}

	/** Focused seam for integration tests; BullMQ invokes the same handler. */
	async processJob(job: Job<DeliveryJob>): Promise<void> {
		return this.process(job)
	}

	async close(): Promise<void> {
		await this.worker?.close()
		await this.queue.close()
	}
}

interface PropPostDestination {
	guild_id: string
	channel_id: string
	over_outcome_uuid: string
	under_outcome_uuid: string
}

function parsePropPostDestination(destinationId: string): PropPostDestination {
	const [
		prefix,
		guild_id,
		channel_id,
		over_outcome_uuid,
		under_outcome_uuid,
	] = destinationId.split(':')
	if (
		prefix !== 'prop-post' ||
		!guild_id ||
		!channel_id ||
		!over_outcome_uuid ||
		!under_outcome_uuid
	) {
		throw new Error(`Invalid prop-post destination ${destinationId}`)
	}
	return {
		guild_id,
		channel_id,
		over_outcome_uuid,
		under_outcome_uuid,
	}
}

function isDuplicateQueueError(error: unknown): boolean {
	const candidate = error as { code?: string; message?: string }
	return (
		candidate.code === 'ERR_JOB_EXISTS' ||
		(candidate.message?.toLowerCase().includes('already exists') ?? false)
	)
}

function updateDestination(
	record: DeliveryRecord,
	destinationId: string,
	patch: Partial<DeliveryRecord['destinations'][number]>,
): DeliveryRecord {
	return {
		...record,
		destinations: record.destinations.map((destination) =>
			destination.id === destinationId
				? {
						...destination,
						...patch,
						attempts:
							patch.state === 'processing'
								? destination.attempts + 1
								: destination.attempts,
					}
				: destination,
		),
	}
}

let defaultQueue: NotificationDeliveryQueue | undefined

export function getNotificationDeliveryQueue(): NotificationDeliveryQueue {
	if (!defaultQueue) defaultQueue = new NotificationDeliveryQueue()
	return defaultQueue
}
