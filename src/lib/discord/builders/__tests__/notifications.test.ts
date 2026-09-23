import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ParlayResultNotification } from '../../../../utils/api/routes/shared-payload-schemas.js'
import {
	betResultEmbed,
	bigWinParlayEmbed,
	bigWinSingleBetEmbed,
	parlayResultEmbeds,
} from '../notifications.js'

const NOW = '2026-10-04T19:30:00.000Z'

const leg = (
	selection_display: string,
	odds_american: number,
	result: ParlayResultNotification['legs'][number]['result'],
) =>
	({
		selection_display,
		odds_american,
		result,
	}) as ParlayResultNotification['legs'][number]

describe('notification builders (classic, pre-migration)', () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date(NOW))
	})
	afterEach(() => vi.useRealTimers())

	it('pins the won bet DM (E1)', () => {
		expect(
			betResultEmbed({
				userId: 'u',
				betId: 48213,
				result: {
					outcome: 'won',
					team: 'Kansas City Chiefs',
					betAmount: 100,
					payout: 174.07,
					profit: 74.07,
				},
				displayResult: {
					outcome: 'won',
					team: 'Kansas City Chiefs',
					betAmount: 100,
					payout: 174.07,
					profit: 74.07,
					displayBetAmount: '$100.00',
					displayPayout: '$174.07',
					displayProfit: '$74.07',
					displayOldBalance: '$900.00',
					displayNewBalance: '$1,074.07',
				},
			})?.toJSON(),
		).toEqual({
			title: '🎉 Bet Won! 🎉',
			color: 0x57f287,
			fields: [
				{
					name: '🎯 Team Selected',
					value: 'Kansas City Chiefs',
					inline: true,
				},
				{ name: '💰 Bet Amount', value: '$100.00', inline: true },
				{ name: '💫 Profit', value: '$74.07', inline: true },
				{ name: '🏆 Total Payout', value: '$174.07', inline: false },
				{
					name: '📊 Balance Update',
					value: '$900.00 → $1,074.07',
					inline: false,
				},
			],
			timestamp: NOW,
			footer: { text: 'Pluto | Bet ID: 48213', icon_url: undefined },
		})
	})

	it('pins the lost and push bet DMs (E1)', () => {
		const lost = betResultEmbed({
			userId: 'u',
			result: { outcome: 'lost', team: 'Buffalo Bills', betAmount: 50 },
			displayResult: {
				outcome: 'lost',
				team: 'Buffalo Bills',
				betAmount: 50,
				displayBetAmount: '$50.00',
			},
		})?.toJSON()
		expect(lost).toMatchObject({
			title: '❌ Bet Lost',
			color: 0xff6961,
			fields: [
				{
					name: '🎯 Team Selected',
					value: 'Buffalo Bills',
					inline: true,
				},
				{ name: '💸 Lost', value: '$50.00', inline: true },
			],
			footer: { text: 'Pluto | Bet ID unavailable' },
		})

		const push = betResultEmbed({
			userId: 'u',
			betId: 7,
			result: { outcome: 'push', team: 'Buffalo Bills', betAmount: 50 },
			displayResult: {
				outcome: 'push',
				team: 'Buffalo Bills',
				betAmount: 50,
				displayBetAmount: '$50.00',
			},
		})?.toJSON()
		expect(push).toMatchObject({
			title: '🔄 Bet Refunded - Tie Game',
			color: 0xffa500,
			footer: { text: 'Pluto | Bet ID: 7' },
		})
		expect(push?.fields?.[2]).toEqual({
			name: 'ℹ️ Reason',
			value: 'The match ended in a tie. Your bet has been refunded.',
			inline: false,
		})
	})

	it('pins the won parlay DM and splits long parlays (E2)', () => {
		const base: ParlayResultNotification = {
			kind: 'won',
			parlay_id: 'p-1',
			user_id: 'u',
			stake: 50,
			combined_odds_american: 1245,
			actual_payout: 672.5,
			old_balance: 1250,
			new_balance: 1922.5,
			legs: [leg('Chiefs ML', -135, 'won'), leg('Lions ML', 105, 'won')],
		}
		const [embed, ...rest] = parlayResultEmbeds(base)
		expect(rest).toHaveLength(0)
		expect(embed.toJSON()).toEqual({
			title: '🎉 Parlay Won! 🎉',
			color: 0x57f287,
			timestamp: NOW,
			footer: { text: 'Pluto | Parlay ID: p-1', icon_url: undefined },
			fields: [
				{ name: '📈 Combined Odds', value: '+1245', inline: true },
				{ name: '💰 Stake', value: '$50.00', inline: true },
				{ name: '🏆 Payout', value: '$672.50', inline: true },
				{
					name: '📊 Balance Update',
					value: '$1,250.00 → $1,922.50',
					inline: false,
				},
				{
					name: '🧾 Legs',
					value: '✅ Chiefs ML (-135)\n✅ Lions ML (+105)',
					inline: false,
				},
			],
		})

		const long = parlayResultEmbeds({
			...base,
			legs: Array.from({ length: 400 }, (_, i) =>
				leg(`Leg ${i} ${'x'.repeat(40)}`, -110, 'pending'),
			),
		})
		expect(long.length).toBeGreaterThan(1)
		expect(long[1].toJSON().title).toBe('🧾 Parlay Legs (continued)')
	})

	it('pins the big-win announcements (E3)', () => {
		expect(
			bigWinParlayEmbed({
				parlayId: 'p-1',
				guildId: 'g',
				userId: '42',
				payout: 672.5,
				stake: 50,
				combinedOddsAmerican: 1245,
				legs: 5,
			}).toJSON(),
		).toEqual({
			title: '💰 Big Parlay Win! 💰',
			description: '<@42> just hit a huge parlay!',
			color: 0x57f287,
			fields: [
				{ name: '🧾 Legs', value: '5', inline: true },
				{ name: '📈 Combined Odds', value: '+1245', inline: true },
				{ name: '🏆 Payout', value: '$672.50', inline: false },
			],
			footer: { text: 'Parlay ID: p-1', icon_url: undefined },
			timestamp: NOW,
		})

		const single = bigWinSingleBetEmbed({
			betId: 9,
			guildId: 'g',
			userId: '42',
			payout: 845,
			betAmount: 200,
			team: 'Detroit Lions',
			oddsAmerican: -125,
		}).toJSON()
		expect(single).toMatchObject({
			title: '💰 Big Win! 💰',
			description: '<@42> just landed a big win!',
			footer: { text: 'Bet ID: 9' },
		})
		expect(single.fields).toEqual([
			{ name: '🎯 Selection', value: 'Detroit Lions', inline: true },
			{ name: '📈 Odds', value: '-125', inline: true },
			{ name: '🏆 Payout', value: '$845.00', inline: false },
		])
	})
})
