import { beforeEach, describe, expect, it, vi } from 'vitest'

const logger = vi.hoisted(() => ({
	error: vi.fn(),
	warn: vi.fn(),
	info: vi.fn(),
}))

vi.mock('../../../../logging/WinstonLogger.js', () => ({ logger }))

import NotificationService from '../notifications.service.js'

describe('NotificationService', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('delivers winners when the wire payload omits optional balances', async () => {
		const service = new NotificationService()
		const notifyUser = vi
			.spyOn(service, 'notifyUser')
			.mockResolvedValue(undefined)

		await service.processBetResults({
			winners: [
				{
					userId: 'user-1',
					betId: 101,
					result: {
						outcome: 'won',
						team: 'Home',
						betAmount: 10,
						payout: 20,
						profit: 10,
					},
				},
			],
			losers: [],
			pushes: [],
		})

		expect(notifyUser).toHaveBeenCalledWith(
			expect.objectContaining({
				displayResult: expect.objectContaining({
					displayOldBalance: 'Unavailable',
					displayNewBalance: 'Unavailable',
				}),
			}),
		)
		expect(logger.warn).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'notification_balance_unavailable',
			}),
		)
	})

	it('does not forward winners without bet IDs to single-bet announcements', async () => {
		const service = new NotificationService()
		const notifyUser = vi
			.spyOn(service, 'notifyUser')
			.mockResolvedValue(undefined)
		const getBigWinAnnouncementService = vi
			.spyOn(
				service as unknown as {
					getBigWinAnnouncementService: () => Promise<unknown>
				},
				'getBigWinAnnouncementService',
			)
			.mockResolvedValue({})

		await service.processBetResults({
			winners: [
				{
					userId: 'user-1',
					guildId: 'guild-1',
					result: {
						outcome: 'won',
						team: 'Home',
						betAmount: 10,
						payout: 20,
						profit: 10,
					},
				},
			],
			losers: [],
			pushes: [],
		})

		expect(notifyUser).toHaveBeenCalledOnce()
		expect(getBigWinAnnouncementService).not.toHaveBeenCalled()
	})
})
