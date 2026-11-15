import type { TextChannel } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../cron/delivery.js', () => ({
	resolveDeliveryChannel: vi.fn(),
}))

import type {
	PeriodWinnersResponse,
	WeeklyRecapResponse,
} from '../../api/Khronos/recap/recap-wrapper.js'
import { resolveDeliveryChannel } from '../../cron/delivery.js'
import {
	explicitChannelResolver,
	RecapPostService,
} from '../recap-post-service.js'

const resolve = resolveDeliveryChannel as unknown as ReturnType<typeof vi.fn>

const recap: WeeklyRecapResponse = {
	window: {
		start_date: '2026-11-09T05:00:00.000Z',
		end_date: '2026-11-16T05:00:00.000Z',
		week_number: 46,
		season_year: 2026,
		sport: 'nfl',
	},
	total_predictions: 1,
	correct_predictions: 1,
	incorrect_predictions: 0,
	accuracy: 100,
	accuracy_delta: 0,
	top_predictors: [],
	biggest_single_win: null,
	biggest_parlay_win: null,
}

const winners: PeriodWinnersResponse = {
	sport: 'nba',
	period: 'monthly',
	window: {
		start_date: '2026-11-01T04:00:00.000Z',
		end_date: '2026-12-01T05:00:00.000Z',
		label: 'November 2026',
	},
	participants: 3,
	unresolved_events: 0,
	winners: [
		{
			user_id: 'user-1',
			rank: 1,
			net_profit: 25,
			roi: 0.5,
			settled_bets: 2,
			total_staked: 50,
		},
	],
	leaderboard: [],
}

function harness() {
	const send = vi.fn(async () => ({ id: 'message-1' }))
	const channel = { id: 'channel-1', send } as unknown as TextChannel
	resolve.mockResolvedValue(channel)
	const recapApi = {
		getWeeklyRecap: vi.fn(async () => recap),
		getPeriodWinners: vi.fn(async () => winners),
	}
	return {
		send,
		recapApi,
		service: new RecapPostService(recapApi, explicitChannelResolver),
	}
}

describe('RecapPostService', () => {
	beforeEach(() => {
		resolve.mockReset()
	})

	it('posts the weekly embed to the resolved channel', async () => {
		const { service, send, recapApi } = harness()

		await expect(
			service.post({
				guildId: 'guild-1',
				channelId: 'channel-1',
				type: 'weekly',
				sport: 'nfl',
			}),
		).resolves.toEqual({
			channel_id: 'channel-1',
			message_id: 'message-1',
		})
		expect(recapApi.getWeeklyRecap).toHaveBeenCalledWith(
			'guild-1',
			0,
			'nfl',
		)
		expect(send).toHaveBeenCalledWith({
			embeds: expect.any(Array),
		})
	})

	it('posts the closed monthly period winners', async () => {
		const { service, recapApi } = harness()

		await service.post({
			guildId: 'guild-1',
			channelId: 'channel-1',
			type: 'monthly',
			sport: 'nba',
		})

		expect(recapApi.getPeriodWinners).toHaveBeenCalledWith({
			guildId: 'guild-1',
			sport: 'nba',
			period: 'monthly',
			periodOffset: 0,
		})
	})

	it('refuses a monthly post with no winners', async () => {
		const { service, recapApi, send } = harness()
		recapApi.getPeriodWinners.mockResolvedValue({
			...winners,
			winners: [],
		})

		await expect(
			service.post({
				guildId: 'guild-1',
				channelId: 'channel-1',
				type: 'monthly',
				sport: 'nba',
			}),
		).rejects.toThrow(/no monthly winners/)
		expect(send).not.toHaveBeenCalled()
	})

	it('never falls back to another channel for a staff post', async () => {
		await expect(
			explicitChannelResolver.getBettingChannel('guild-1'),
		).rejects.toThrow(/explicit channel/)
	})
})
