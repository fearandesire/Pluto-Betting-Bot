import type { TextChannel } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../logging/WinstonLogger.js', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}))

import type { WeeklyRecapResponse } from '../../api/Khronos/recap/recap-wrapper.js'
import { RecapCronService } from '../RecapCronService.js'

const recap: WeeklyRecapResponse = {
	window: {
		start_date: '2026-07-06T00:00:00.000Z',
		end_date: '2026-07-12T23:59:59.999Z',
		week_number: 19,
		season_year: 2026,
	},
	total_predictions: 1,
	correct_predictions: 1,
	incorrect_predictions: 0,
	accuracy: 100,
	accuracy_delta: 10,
	top_predictors: [],
	biggest_single_win: null,
	biggest_parlay_win: null,
}

function makeHarness() {
	const values = new Map<string, unknown>()
	const cache = {
		get: vi.fn(async (key: string) => values.get(key) ?? false),
		set: vi.fn(async (key: string, value: unknown) => {
			values.set(key, value)
			return true
		}),
		del: vi.fn(async (key: string) => {
			values.delete(key)
			return 1
		}),
	}
	const channel = {
		id: 'recap-channel',
		send: vi.fn(async () => ({ id: 'message-1' })),
	} as unknown as TextChannel
	const channelResolver = {
		getBettingChannel: vi.fn(async () => channel),
	}
	const recapApi = {
		getWeeklyRecap: vi.fn(async () => recap),
	}

	return { cache, channel, channelResolver, recapApi }
}

describe('RecapCronService', () => {
	beforeEach(() => vi.clearAllMocks())

	it('posts once and skips the same guild/week after a restart', async () => {
		const harness = makeHarness()
		const service = new RecapCronService(
			harness.recapApi,
			harness.cache,
			harness.channelResolver,
			{ guildIds: ['guild-1'] },
		)

		expect(await service.runWeeklyRecap()).toEqual({
			posted: 1,
			skipped: 0,
			failed: 0,
		})
		expect(await service.runWeeklyRecap()).toEqual({
			posted: 0,
			skipped: 1,
			failed: 0,
		})
		expect(harness.channel.send).toHaveBeenCalledTimes(1)
		expect(harness.cache.set).toHaveBeenCalledWith(
			'recap:posted:guild-1:2026:19',
			true,
			691200,
		)
	})

	it('isolates Khronos or Discord failures per guild', async () => {
		const harness = makeHarness()
		harness.recapApi.getWeeklyRecap
			.mockRejectedValueOnce(new Error('Khronos 503'))
			.mockResolvedValueOnce(recap)
		const service = new RecapCronService(
			harness.recapApi,
			harness.cache,
			harness.channelResolver,
			{ guildIds: ['guild-1', 'guild-2'] },
		)

		expect(await service.runWeeklyRecap()).toEqual({
			posted: 1,
			skipped: 0,
			failed: 1,
		})
		expect(harness.channel.send).toHaveBeenCalledTimes(1)
	})

	it('does not call Khronos when disabled', async () => {
		const harness = makeHarness()
		const service = new RecapCronService(
			harness.recapApi,
			harness.cache,
			harness.channelResolver,
			{ guildIds: ['guild-1'], enabled: false },
		)

		expect(await service.runWeeklyRecap()).toEqual({
			posted: 0,
			skipped: 0,
			failed: 0,
		})
		expect(harness.recapApi.getWeeklyRecap).not.toHaveBeenCalled()
	})

	it('retains a sent marker lease when the first dedup write fails', async () => {
		const harness = makeHarness()
		harness.cache.set
			.mockResolvedValueOnce(true)
			.mockRejectedValueOnce(new Error('Redis write failed'))
			.mockResolvedValueOnce(true)
		const service = new RecapCronService(
			harness.recapApi,
			harness.cache,
			harness.channelResolver,
			{ guildIds: ['guild-1'] },
		)

		expect(await service.runWeeklyRecap()).toEqual({
			posted: 1,
			skipped: 0,
			failed: 0,
		})
		expect(harness.cache.set).toHaveBeenLastCalledWith(
			'recap:posted:guild-1:2026:19',
			{ status: 'sent' },
			691200,
		)
	})

	it('reclaims a processing marker during startup catch-up', async () => {
		const harness = makeHarness()
		await harness.cache.set('recap:posted:guild-1:2026:19', {
			status: 'processing',
		})
		const service = new RecapCronService(
			harness.recapApi,
			harness.cache,
			harness.channelResolver,
			{ guildIds: ['guild-1'] },
		)

		expect(
			await service.runWeeklyRecap(
				new Date('2026-07-13T10:15:00.000Z'),
				true,
			),
		).toEqual({
			posted: 1,
			skipped: 0,
			failed: 0,
		})
		expect(harness.cache.del).toHaveBeenCalledWith(
			'recap:posted:guild-1:2026:19',
		)
		expect(harness.channel.send).toHaveBeenCalledTimes(1)
	})
})
