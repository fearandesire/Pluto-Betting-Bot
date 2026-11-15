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

vi.mock('../delivery.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../delivery.js')>()
	return {
		...actual,
		resolveDeliveryChannel: vi.fn(),
	}
})

import { resolveDeliveryChannel } from '../delivery.js'
import { LeaderboardAutoPostService } from '../LeaderboardAutoPostService.js'

const resolve = resolveDeliveryChannel as unknown as ReturnType<typeof vi.fn>

function harness() {
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
	const send = vi.fn(async () => ({ id: 'message-1' }))
	const channel = {
		id: 'leaderboard-channel',
		send,
	} as unknown as TextChannel
	resolve.mockResolvedValue(channel)
	const leaderboardApi = {
		getLeaderboard: vi.fn(async () => ({
			entries: [
				{
					user_id: 'user-1',
					total_predictions: 10,
					correct_predictions: 8,
					incorrect_predictions: 2,
					success_rate: 80,
					current_streak: 2,
					best_streak: 4,
					badge_tier: null,
				},
			],
			total_users: 1,
		})),
	}
	const service = new LeaderboardAutoPostService(
		leaderboardApi,
		cache,
		{ getBettingChannel: vi.fn() },
		{
			period: 'week',
			targets: [{ guildId: 'guild-1', channelId: 'channel-1' }],
		},
	)
	return { service, send, cache, leaderboardApi }
}

describe('LeaderboardAutoPostService', () => {
	beforeEach(() => {
		resolve.mockReset()
	})

	it('posts the filtered props leaderboard once per window', async () => {
		const { service, send, leaderboardApi } = harness()
		const now = new Date('2026-11-16T09:00:00.000Z')

		await expect(service.runWeeklyRecap(now)).resolves.toEqual({
			posted: 1,
			skipped: 0,
			failed: 0,
		})
		expect(leaderboardApi.getLeaderboard).toHaveBeenCalledWith({
			guildId: 'guild-1',
			period: 'week',
			type: 'props',
		})
		expect(send).toHaveBeenCalledTimes(1)

		await expect(service.runWeeklyRecap(now)).resolves.toEqual({
			posted: 0,
			skipped: 1,
			failed: 0,
		})
		expect(send).toHaveBeenCalledTimes(1)
	})

	it('skips a window with no prop predictions', async () => {
		const { service, send, leaderboardApi } = harness()
		leaderboardApi.getLeaderboard.mockResolvedValue({
			entries: [],
			total_users: 0,
		})

		await expect(
			service.runWeeklyRecap(new Date('2026-11-16T09:00:00.000Z')),
		).resolves.toEqual({ posted: 0, skipped: 1, failed: 0 })
		expect(send).not.toHaveBeenCalled()
	})

	it('posts a monthly board only on the last Eastern day', async () => {
		const { send } = harness()
		const monthly = new LeaderboardAutoPostService(
			{
				getLeaderboard: vi.fn(async () => ({
					entries: [],
					total_users: 0,
				})),
			},
			{ get: vi.fn(), set: vi.fn() },
			{ getBettingChannel: vi.fn() },
			{
				period: 'month',
				targets: [{ guildId: 'guild-1', channelId: 'channel-1' }],
			},
		)

		await expect(
			monthly.runWeeklyRecap(new Date('2026-11-29T23:00:00.000Z')),
		).resolves.toEqual({ posted: 0, skipped: 0, failed: 0 })

		const posting = new LeaderboardAutoPostService(
			{
				getLeaderboard: vi.fn(async () => ({
					entries: [],
					total_users: 0,
				})),
			},
			{ get: vi.fn(), set: vi.fn() },
			{ getBettingChannel: vi.fn() },
			{
				period: 'month',
				targets: [{ guildId: 'guild-1', channelId: 'channel-1' }],
			},
		)
		await expect(
			posting.runWeeklyRecap(new Date('2026-11-30T23:00:00.000Z')),
		).resolves.toEqual({ posted: 0, skipped: 1, failed: 0 })
		expect(send).not.toHaveBeenCalled()
	})

	it('does not resolve a channel when no target is enabled', async () => {
		const { service, send } = harness()
		const disabled = new LeaderboardAutoPostService(
			{ getLeaderboard: vi.fn() },
			{ get: vi.fn(), set: vi.fn() },
			{ getBettingChannel: vi.fn() },
			{ period: 'month', targets: [], enabled: false },
		)

		await expect(disabled.runWeeklyRecap()).resolves.toEqual({
			posted: 0,
			skipped: 0,
			failed: 0,
		})
		await service.runWeeklyRecap()
		expect(send).toHaveBeenCalledTimes(1)
	})
})
