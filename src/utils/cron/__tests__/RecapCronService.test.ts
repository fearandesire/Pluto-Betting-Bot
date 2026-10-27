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
import { logger } from '../../logging/WinstonLogger.js'
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
	const send = vi.fn(async (_payload: unknown) => ({ id: 'message-1' }))
	const channel = { id: 'recap-channel', send } as unknown as TextChannel
	const channelResolver = {
		getBettingChannel: vi.fn(async () => channel),
	}
	const recapApi = {
		getWeeklyRecap: vi.fn(
			async (
				_guildId: string,
				_weekOffset?: number,
				_sport?: 'nfl' | 'nba',
			) => recap,
		),
	}

	return { cache, channel, send, channelResolver, recapApi }
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

	it('keeps the NFL request and key untouched when NBA is disabled', async () => {
		const harness = makeHarness()
		const service = new RecapCronService(
			harness.recapApi,
			harness.cache,
			harness.channelResolver,
			{ guildIds: ['guild-1'] },
		)

		await service.runWeeklyRecap()

		expect(harness.recapApi.getWeeklyRecap).toHaveBeenCalledTimes(1)
		expect(harness.recapApi.getWeeklyRecap).toHaveBeenCalledWith(
			'guild-1',
			-1,
		)
		const [payload] = harness.send.mock.calls[0] as unknown as [
			{ embeds: Array<{ toJSON(): { title?: string } }> },
		]
		expect(payload.embeds[0].toJSON().title).toBe('📊 Week 19 Recap')
	})

	describe('NBA pass', () => {
		const nbaRecap: WeeklyRecapResponse = {
			...recap,
			window: { ...recap.window, week_number: 28, sport: 'nba' },
		}

		function makeNbaHarness(nba: WeeklyRecapResponse = nbaRecap) {
			const harness = makeHarness()
			harness.recapApi.getWeeklyRecap.mockImplementation(
				async (
					_guildId: string,
					_offset?: number,
					sport?: 'nfl' | 'nba',
				) => (sport === 'nba' ? nba : recap),
			)
			return harness
		}

		it('posts an NBA recap with its own dedup key after the NFL one', async () => {
			const harness = makeNbaHarness()
			const service = new RecapCronService(
				harness.recapApi,
				harness.cache,
				harness.channelResolver,
				{ guildIds: ['guild-1'], nbaEnabled: true },
			)

			expect(await service.runWeeklyRecap()).toEqual({
				posted: 2,
				skipped: 0,
				failed: 0,
			})
			expect(harness.recapApi.getWeeklyRecap).toHaveBeenNthCalledWith(
				2,
				'guild-1',
				-1,
				'nba',
			)
			expect(harness.cache.set).toHaveBeenCalledWith(
				'recap:posted:nba:guild-1:2026:28',
				true,
				691200,
			)
			const titles = harness.send.mock.calls.map(
				(call) =>
					(
						call[0] as unknown as {
							embeds: Array<{ toJSON(): { title?: string } }>
						}
					).embeds[0].toJSON().title,
			)
			expect(titles).toEqual(['📊 Week 19 Recap', '📊 NBA Week 28 Recap'])
		})

		it('replays idempotently', async () => {
			const harness = makeNbaHarness()
			const service = new RecapCronService(
				harness.recapApi,
				harness.cache,
				harness.channelResolver,
				{ guildIds: ['guild-1'], nbaEnabled: true },
			)

			await service.runWeeklyRecap()
			expect(await service.runWeeklyRecap()).toEqual({
				posted: 0,
				skipped: 2,
				failed: 0,
			})
			expect(harness.channel.send).toHaveBeenCalledTimes(2)
		})

		it('posts nothing for an empty NBA week', async () => {
			const harness = makeNbaHarness({
				...nbaRecap,
				total_predictions: 0,
				correct_predictions: 0,
			})
			const service = new RecapCronService(
				harness.recapApi,
				harness.cache,
				harness.channelResolver,
				{ guildIds: ['guild-1'], nbaEnabled: true },
			)

			expect(await service.runWeeklyRecap()).toEqual({
				posted: 1,
				skipped: 1,
				failed: 0,
			})
			expect(harness.channel.send).toHaveBeenCalledTimes(1)
			expect(harness.cache.set).not.toHaveBeenCalledWith(
				expect.stringContaining('recap:posted:nba'),
				expect.anything(),
				expect.anything(),
			)
			expect(logger.info).toHaveBeenCalledWith({
				message: 'weekly_recap_skipped',
				metadata: {
					reason: 'empty_week',
					guild_id: 'guild-1',
					sport: 'nba',
				},
			})
		})

		it('does not let an NBA failure affect the NFL post', async () => {
			const harness = makeNbaHarness()
			harness.recapApi.getWeeklyRecap.mockImplementation(
				async (
					_guildId: string,
					_offset?: number,
					sport?: 'nfl' | 'nba',
				) => {
					if (sport === 'nba') throw new Error('Khronos 503')
					return recap
				},
			)
			const service = new RecapCronService(
				harness.recapApi,
				harness.cache,
				harness.channelResolver,
				{ guildIds: ['guild-1'], nbaEnabled: true },
			)

			expect(await service.runWeeklyRecap()).toEqual({
				posted: 1,
				skipped: 0,
				failed: 1,
			})
		})
	})
})
