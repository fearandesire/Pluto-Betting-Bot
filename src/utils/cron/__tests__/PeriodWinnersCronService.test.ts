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

import type {
	PeriodWinnersRequest,
	PeriodWinnersResponse,
} from '../../api/Khronos/recap/recap-wrapper.js'
import { PeriodWinnersCronService } from '../PeriodWinnersCronService.js'

function response(
	request: PeriodWinnersRequest,
	winners: PeriodWinnersResponse['winners'],
): PeriodWinnersResponse {
	return {
		sport: request.sport,
		period: request.period,
		window: {
			start_date: '2026-06-29T00:00:00.000Z',
			end_date: '2026-07-05T23:59:59.999Z',
			label: 'Jun 29 – Jul 5',
		},
		participants: 4,
		unresolved_events: 0,
		winners,
		leaderboard: winners,
	}
}

const winner = (userId: string) => ({
	user_id: userId,
	rank: 1,
	net_profit: 100,
	roi: 10,
	settled_bets: 5,
	total_staked: 1000,
})

function makeHarness(winners = [winner('111')]) {
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
	const channelResolver = { getBettingChannel: vi.fn(async () => channel) }
	const recapApi = {
		getPeriodWinners: vi.fn(async (request: PeriodWinnersRequest) =>
			response(request, winners),
		),
	}
	return { cache, send, channelResolver, recapApi }
}

function makeService(
	harness: ReturnType<typeof makeHarness>,
	options: Partial<
		ConstructorParameters<typeof PeriodWinnersCronService>[3]
	> = {},
) {
	return new PeriodWinnersCronService(
		harness.recapApi,
		harness.cache,
		harness.channelResolver,
		{ guildIds: ['guild-1'], enabled: true, ...options },
	)
}

describe('PeriodWinnersCronService', () => {
	beforeEach(() => vi.clearAllMocks())

	it('posts the closed previous period once and dedups a replay', async () => {
		const harness = makeHarness()
		const service = makeService(harness)

		expect(await service.runPeriodWinners('weekly')).toEqual({
			posted: 1,
			skipped: 0,
			failed: 0,
		})
		expect(await service.runPeriodWinners('weekly')).toEqual({
			posted: 0,
			skipped: 1,
			failed: 0,
		})
		expect(harness.send).toHaveBeenCalledTimes(1)
		expect(harness.recapApi.getPeriodWinners).toHaveBeenCalledWith({
			guildId: 'guild-1',
			sport: 'nfl',
			period: 'weekly',
			periodOffset: -1,
		})
		expect(harness.cache.set).toHaveBeenCalledWith(
			'winners:posted:guild-1:nfl:weekly:2026-06-29T00:00:00.000Z',
			true,
			expect.any(Number),
		)
	})

	it('posts tied winners in a single message', async () => {
		const harness = makeHarness([winner('111'), winner('222')])
		const service = makeService(harness)

		await service.runPeriodWinners('monthly')

		expect(harness.send).toHaveBeenCalledTimes(1)
		expect(JSON.stringify(harness.send.mock.calls[0][0])).toContain(
			'Co-winners',
		)
	})

	it('posts nothing when nobody profited', async () => {
		const harness = makeHarness([])
		const service = makeService(harness)

		expect(await service.runPeriodWinners('weekly')).toEqual({
			posted: 0,
			skipped: 1,
			failed: 0,
		})
		expect(harness.send).not.toHaveBeenCalled()
		expect(harness.cache.set).not.toHaveBeenCalled()
	})

	it('does not call Khronos when disabled', async () => {
		const harness = makeHarness()
		const service = makeService(harness, { enabled: false })

		expect(await service.runPeriodWinners('weekly')).toEqual({
			posted: 0,
			skipped: 0,
			failed: 0,
		})
		expect(harness.recapApi.getPeriodWinners).not.toHaveBeenCalled()
	})

	it('only queries the configured sports and keeps keys per sport', async () => {
		const harness = makeHarness()
		const nflOnly = makeService(harness)
		await nflOnly.runPeriodWinners('weekly')
		expect(
			harness.recapApi.getPeriodWinners.mock.calls.map(
				([request]) => request.sport,
			),
		).toEqual(['nfl'])

		const both = makeService(makeHarness(), { sports: ['nfl', 'nba'] })
		expect(await both.runPeriodWinners('weekly')).toMatchObject({
			posted: 2,
		})
	})

	it('releases the claim and counts a failed send so a retry can post', async () => {
		const harness = makeHarness()
		harness.send.mockRejectedValueOnce(new Error('Discord 500'))
		const service = makeService(harness)

		expect(await service.runPeriodWinners('weekly')).toMatchObject({
			failed: 1,
			posted: 0,
		})
		expect(await service.runPeriodWinners('weekly')).toMatchObject({
			posted: 1,
		})
	})

	it('reclaims a stale processing marker during startup catch-up', async () => {
		const harness = makeHarness()
		await harness.cache.set(
			'winners:posted:guild-1:nfl:weekly:2026-06-29T00:00:00.000Z',
			{ status: 'processing' },
		)
		const service = makeService(harness)

		expect(await service.runPeriodWinners('weekly', true)).toMatchObject({
			posted: 1,
		})
	})
})
