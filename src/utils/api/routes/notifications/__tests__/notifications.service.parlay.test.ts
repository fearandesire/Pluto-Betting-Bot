import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	send: vi.fn(),
	fetch: vi.fn(),
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}))

vi.mock('@sapphire/framework', () => ({
	container: {
		client: {
			users: {
				fetch: mocks.fetch,
			},
		},
	},
}))

vi.mock('../../../../logging/WinstonLogger.js', () => ({
	logger: mocks.logger,
}))

import NotificationService from '../notifications.service.js'

const baseLeg = {
	id: '00000000-0000-0000-0000-000000000001',
	event_id: 'event-1',
	outcome_uuid: 'outcome-1',
	market_key: 'h2h' as const,
	selection_display: 'Lakers',
	odds_american: 125,
	point: null,
	commence_time: new Date('2026-07-11T20:00:00.000Z'),
	result: 'won' as const,
}

function makePayload(kind: 'won' | 'busted' | 'push_refunded') {
	return {
		kind,
		parlay_id: '11111111-1111-4111-8111-111111111110',
		user_id: 'user-1',
		stake: 10,
		combined_odds_american: 377,
		payout: kind === 'won' ? 47.7 : 0,
		actual_payout:
			kind === 'won' ? 47.7 : kind === 'push_refunded' ? 10 : 0,
		refund_amount: kind === 'push_refunded' ? 10 : undefined,
		old_balance: kind === 'won' ? 100 : undefined,
		new_balance: kind === 'won' ? 137.7 : undefined,
		legs: [
			baseLeg,
			{
				...baseLeg,
				id: '00000000-0000-0000-0000-000000000002',
				event_id: 'event-2',
				selection_display: 'Celtics',
				odds_american: -110,
				result:
					kind === 'busted'
						? ('lost' as const)
						: kind === 'push_refunded'
							? ('push' as const)
							: ('won' as const),
			},
		],
	}
}

describe('NotificationService.processParlayResult', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.fetch.mockResolvedValue({ send: mocks.send })
	})

	it.each([
		['won', '🎉 Parlay Won! 🎉', 0x57f287],
		['busted', '❌ Parlay Busted', 0xff6961],
		['push_refunded', '🔄 Parlay Refunded', 0xffa500],
	] as const)('sends a distinct %s multi-leg embed', async (kind, title, color) => {
		await new NotificationService().processParlayResult(makePayload(kind))

		expect(mocks.fetch).toHaveBeenCalledWith('user-1')
		expect(mocks.send).toHaveBeenCalledOnce()
		const [message] = mocks.send.mock.calls[0] as [
			{ embeds: Array<{ toJSON: () => Record<string, unknown> }> },
		]
		const embed = message.embeds[0].toJSON()
		expect(embed.title).toBe(title)
		expect(embed.color).toBe(color)
		expect(embed.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: '🧾 Legs' }),
				expect.objectContaining({
					name: '📈 Combined Odds',
					value: '+377',
				}),
			]),
		)
		const legsField = (
			embed.fields as Array<{ name: string; value: string }>
		).find((field) => field.name === '🧾 Legs')
		expect(legsField?.value).toContain('+125')
		expect(legsField?.value).toContain('-110')
	})

	it('logs Discord delivery errors as critical and does not throw', async () => {
		mocks.fetch.mockRejectedValue(new Error('DMs closed'))

		await expect(
			new NotificationService().processParlayResult(makePayload('won')),
		).resolves.toBeUndefined()

		expect(mocks.logger.error).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'parlay.notification.delivery_failed',
				critical: true,
				parlay_id: '11111111-1111-4111-8111-111111111110',
			}),
		)
	})

	it('falls back to payout and stake when nullable amounts are absent', async () => {
		const payload = {
			...makePayload('won'),
			actual_payout: null,
			payout: 47.7,
		}
		await new NotificationService().processParlayResult(payload)
		const embed = (
			mocks.send.mock.calls[0][0].embeds[0] as {
				toJSON: () => { fields: Array<{ name: string; value: string }> }
			}
		).toJSON()
		expect(embed.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ name: '🏆 Payout', value: '$47.70' }),
			]),
		)
	})

	it('renders an unavailable payout instead of $0.00 when no amount is present', async () => {
		const payload = {
			...makePayload('won'),
			actual_payout: null,
			payout: undefined,
		}
		await new NotificationService().processParlayResult(payload)
		const embed = (
			mocks.send.mock.calls[0][0].embeds[0] as {
				toJSON: () => { fields: Array<{ name: string; value: string }> }
			}
		).toJSON()
		expect(embed.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: '🏆 Payout',
					value: 'Unavailable',
				}),
			]),
		)
	})

	it('keeps every leg field within Discord limits', async () => {
		const payload = {
			...makePayload('won'),
			legs: Array.from({ length: 30 }, (_, index) => ({
				...baseLeg,
				id: `leg-${index}`,
				selection_display: 'A'.repeat(1200),
			})),
		}
		await new NotificationService().processParlayResult(payload)
		const embed = (
			mocks.send.mock.calls[0][0].embeds[0] as {
				toJSON: () => { fields: Array<{ name: string; value: string }> }
			}
		).toJSON()
		for (const field of embed.fields.filter((field) =>
			field.name.startsWith('🧾 Legs'),
		)) {
			expect(field.value.length).toBeLessThanOrEqual(1024)
		}
	})

	it('forwards winning parlays with guild context to big-win announcements', async () => {
		const announceParlayWin = vi.fn().mockResolvedValue(true)
		const bigWinService = { announceParlayWin }
		const payload = {
			...makePayload('won'),
			guild_id: 'guild-1',
		}

		await new NotificationService(
			bigWinService as never,
		).processParlayResult(payload)

		expect(announceParlayWin).toHaveBeenCalledWith(
			expect.objectContaining({
				parlayId: payload.parlay_id,
				guildId: 'guild-1',
				payout: 47.7,
				legs: 2,
			}),
		)
	})
})
