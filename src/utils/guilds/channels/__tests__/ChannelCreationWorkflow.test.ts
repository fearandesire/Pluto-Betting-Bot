import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../logging/WinstonLogger.js', () => ({
	logger: { warn: vi.fn() },
}))

import {
	type ChannelCreationPorts,
	ChannelCreationWorkflow,
} from '../ChannelCreationWorkflow.js'

const intent = {
	guildId: 'guild-1',
	gameId: 'game-1',
	channelName: 'away-at-home',
	marker: 'pluto-game:guild-1:game-1',
}

function ports(): ChannelCreationPorts {
	return {
		reservations: {
			reserve: vi
				.fn()
				.mockResolvedValue({ state: 'acquired', owner: 'owner-a' }),
			recordCreated: vi.fn().mockResolvedValue(undefined),
			release: vi.fn().mockResolvedValue(true),
		},
		discord: {
			findByMarker: vi.fn().mockResolvedValue(null),
			create: vi.fn().mockResolvedValue({
				channelId: 'discord-channel-1',
				complete: vi.fn().mockResolvedValue(undefined),
			}),
		},
	}
}

class ReservationStub {
	private acquired = false

	async reserve(_intent: typeof intent, owner: string) {
		if (this.acquired) return { state: 'busy' as const }
		this.acquired = true
		return { state: 'acquired' as const, owner }
	}

	async recordCreated() {}

	async release() {
		return true
	}
}

describe('ChannelCreationWorkflow', () => {
	afterEach(() => vi.useRealTimers())
	it('creates one channel for concurrent workers on one scheduling intent', async () => {
		const injected = ports()
		injected.reservations = new ReservationStub()
		const workflow = new ChannelCreationWorkflow(injected)
		const results = await Promise.all([
			workflow.run(intent),
			workflow.run(intent),
		])

		expect(results.filter(({ state }) => state === 'created')).toHaveLength(
			1,
		)
		expect(results.filter(({ state }) => state === 'busy')).toHaveLength(1)
		expect(injected.discord.create).toHaveBeenCalledOnce()
	})

	it('replays a recorded channel without creating another one', async () => {
		const injected = ports()
		const workflow = new ChannelCreationWorkflow(injected)
		injected.reservations.reserve = vi.fn().mockResolvedValue({
			state: 'created',
			channelId: 'discord-channel-1',
		})
		injected.discord.findByMarker = vi
			.fn()
			.mockResolvedValue({ id: 'discord-channel-1' })

		expect(await workflow.run(intent)).toEqual({
			state: 'already-created',
			channelId: 'discord-channel-1',
		})
		expect(injected.discord.create).not.toHaveBeenCalled()
	})

	it('reconciles a channel created before recordCreated after an ambiguous failure', async () => {
		const injected = ports()
		const workflow = new ChannelCreationWorkflow(injected)
		const channel = { id: 'discord-channel-1' }
		injected.discord.create = vi
			.fn()
			.mockRejectedValue(new Error('request lost'))
		injected.discord.findByMarker = vi
			.fn()
			.mockResolvedValueOnce(null)
			.mockResolvedValue(channel)

		expect(await workflow.run(intent)).toEqual({
			state: 'reconciled',
			channelId: channel.id,
		})
		expect(injected.discord.create).toHaveBeenCalledOnce()
		expect(injected.reservations.recordCreated).toHaveBeenCalledWith(
			intent,
			expect.any(String),
			channel.id,
		)
	})

	it('records the channel before completing the Discord message side effect', async () => {
		const injected = ports()
		const order: string[] = []
		injected.reservations.recordCreated = vi
			.fn()
			.mockImplementation(async () => {
				order.push('record')
			})
		injected.discord.create = vi.fn().mockResolvedValue({
			channelId: 'discord-channel-1',
			complete: vi.fn().mockImplementation(async () => {
				order.push('send')
			}),
		})

		await new ChannelCreationWorkflow(injected).run(intent)
		expect(order).toEqual(['record', 'send'])
	})

	it('retries completion when the channel was recorded before a send failure', async () => {
		const injected = ports()
		const complete = vi.fn().mockRejectedValueOnce(new Error('send failed'))
		injected.discord.create = vi.fn().mockResolvedValue({
			channelId: 'discord-channel-1',
			complete,
		})
		injected.discord.completeExisting = vi.fn().mockResolvedValue(undefined)
		injected.reservations.reserve = vi
			.fn()
			.mockResolvedValueOnce({ state: 'acquired', owner: 'owner-a' })
			.mockResolvedValueOnce({
				state: 'created',
				channelId: 'discord-channel-1',
			})
		injected.discord.findByMarker = vi
			.fn()
			.mockResolvedValueOnce(null)
			.mockResolvedValue({ id: 'discord-channel-1' })

		await expect(
			new ChannelCreationWorkflow(injected).run(intent),
		).rejects.toThrow('send failed')
		await expect(
			new ChannelCreationWorkflow(injected).run(intent),
		).resolves.toEqual({
			state: 'already-created',
			channelId: 'discord-channel-1',
		})
		expect(injected.discord.completeExisting).toHaveBeenCalledOnce()
	})

	it('does not create after the reservation lease is lost', async () => {
		vi.useFakeTimers()
		const injected = ports()
		let resolveLookup:
			| ((channel: { id: string } | null) => void)
			| undefined
		injected.discord.findByMarker = vi.fn(
			() =>
				new Promise<{ id: string } | null>(
					(resolve) => (resolveLookup = resolve),
				),
		)
		injected.reservations.refresh = vi.fn().mockResolvedValue(false)

		const run = new ChannelCreationWorkflow(injected).run(intent)
		await Promise.resolve()
		await Promise.resolve()
		vi.advanceTimersByTime(60_000)
		resolveLookup?.(null)
		await Promise.resolve()
		await Promise.resolve()

		await expect(run).rejects.toThrow(/lease/i)
		expect(injected.discord.create).not.toHaveBeenCalled()
		expect(injected.reservations.release).toHaveBeenCalled()
	})

	it('does not turn a renewal rejection into an unhandled rejection', async () => {
		vi.useFakeTimers()
		const injected = ports()
		injected.reservations.refresh = vi
			.fn()
			.mockRejectedValue(new Error('redis unavailable'))

		await new ChannelCreationWorkflow(injected).run(intent)
		await vi.advanceTimersByTimeAsync(60_000)
		expect(injected.discord.create).toHaveBeenCalledOnce()
	})

	it('reclaims a stale created result when the channel no longer exists', async () => {
		const injected = ports()
		injected.reservations.reserve = vi.fn().mockResolvedValue({
			state: 'created',
			channelId: 'deleted-channel',
		})
		injected.reservations.reclaimCreated = vi.fn().mockResolvedValue(true)
		injected.discord.findByMarker = vi.fn().mockResolvedValue(null)

		const result = await new ChannelCreationWorkflow(injected).run(intent)

		expect(result).toEqual({
			state: 'created',
			channelId: 'discord-channel-1',
		})
		expect(injected.reservations.reclaimCreated).toHaveBeenCalledWith(
			intent,
			'deleted-channel',
			expect.any(String),
		)
		expect(injected.discord.create).toHaveBeenCalledOnce()
	})
})
