import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	redis: {
		set: vi.fn(),
		incr: vi.fn(),
		expire: vi.fn(),
	},
	sendToBettingChannel: vi.fn(),
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}))

vi.mock('../../../utils/cache/redis-instance.js', () => ({
	default: mocks.redis,
}))

vi.mock('../../../lib/startup/env.js', () => ({
	default: { ANNOUNCE_PAYOUT_THRESHOLD: 100 },
}))

vi.mock('../../../utils/logging/WinstonLogger.js', () => ({
	logger: mocks.logger,
}))

vi.mock('../../../utils/api/Khronos/guild/guild-wrapper.js', () => ({
	default: vi.fn().mockImplementation(function () {
		return { sendToBettingChannel: mocks.sendToBettingChannel }
	}),
}))

import { BigWinAnnouncementService } from '../BigWinAnnouncementService.js'

const parlay = {
	parlayId: 'parlay-1',
	guildId: 'guild-1',
	userId: 'user-1',
	payout: 100,
	stake: 10,
	combinedOddsAmerican: 900,
	legs: 3,
}

describe('BigWinAnnouncementService', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.redis.set.mockResolvedValue('OK')
		mocks.redis.incr.mockResolvedValue(1)
		mocks.redis.expire.mockResolvedValue(1)
		mocks.sendToBettingChannel.mockResolvedValue({})
	})

	it('does not announce below threshold and announces at the boundary', async () => {
		const service = new BigWinAnnouncementService(
			mocks.redis,
			{ sendToBettingChannel: mocks.sendToBettingChannel },
			100,
		)

		await expect(
			service.announceParlayWin({ ...parlay, payout: 99.99 }),
		).resolves.toBe(false)
		expect(mocks.redis.set).not.toHaveBeenCalled()

		await expect(service.announceParlayWin(parlay)).resolves.toBe(true)
		expect(mocks.sendToBettingChannel).toHaveBeenCalledOnce()
		const [, options] = mocks.sendToBettingChannel.mock.calls[0]
		const embed = options.embeds[0].toJSON()
		expect(embed.title).toBe('💰 Big Parlay Win! 💰')
		expect(embed.description).toContain('<@user-1>')
		expect(embed.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: '🧾 Legs', value: '3' }),
				expect.objectContaining({
					name: '🏆 Payout',
					value: '$100.00',
				}),
			]),
		)
	})

	it('uses Redis deduplication to send each parlay only once', async () => {
		const service = new BigWinAnnouncementService(mocks.redis, {
			sendToBettingChannel: mocks.sendToBettingChannel,
		})

		await service.announceParlayWin(parlay)
		mocks.redis.set.mockResolvedValueOnce(null)
		await expect(service.announceParlayWin(parlay)).resolves.toBe(false)

		expect(mocks.sendToBettingChannel).toHaveBeenCalledOnce()
		expect(mocks.redis.set).toHaveBeenNthCalledWith(
			2,
			'pluto:big-win-announcement:sent:parlay:parlay-1',
			'1',
			'EX',
			7 * 24 * 60 * 60,
			'NX',
		)
	})

	it('enforces the per-guild hourly rate limit across announcement kinds', async () => {
		mocks.redis.incr.mockResolvedValue(2)
		const service = new BigWinAnnouncementService(
			mocks.redis,
			{ sendToBettingChannel: mocks.sendToBettingChannel },
			100,
			1,
		)

		await expect(service.announceParlayWin(parlay)).resolves.toBe(false)
		expect(mocks.sendToBettingChannel).not.toHaveBeenCalled()
		expect(mocks.logger.info).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'big_win.announcement_rate_limited',
				guild_id: 'guild-1',
			}),
		)
	})

	it('formats large single-bet wins for the betting channel', async () => {
		const service = new BigWinAnnouncementService(mocks.redis, {
			sendToBettingChannel: mocks.sendToBettingChannel,
		})

		await expect(
			service.announceSingleBetWin({
				betId: 42,
				guildId: 'guild-1',
				userId: 'user-1',
				payout: 250,
				betAmount: 25,
				team: 'Lakers',
				oddsAmerican: 900,
			}),
		).resolves.toBe(true)

		const [, options] = mocks.sendToBettingChannel.mock.calls[0]
		const embed = options.embeds[0].toJSON()
		expect(embed.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: '🎯 Selection',
					value: 'Lakers',
				}),
				expect.objectContaining({ name: '📈 Odds', value: '+900' }),
				expect.objectContaining({
					name: '🏆 Payout',
					value: '$250.00',
				}),
			]),
		)
	})
})
