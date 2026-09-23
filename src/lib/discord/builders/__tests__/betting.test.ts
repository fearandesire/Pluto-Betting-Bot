import { afterEach, describe, expect, it, vi } from 'vitest'
import {
	betCanceledEmbed,
	betCancellationEmbed,
	betConfirmedEmbed,
	betPlacedAnnouncementEmbed,
	doubleDownEmbed,
	formatMatchDate,
	formatPredictionConfirmation,
	parlayPlacedAnnouncementEmbed,
	pendingBetslip,
	predictionPlacedEmbed,
} from '../betting.js'

const avatar = 'https://cdn.discordapp.com/embed/avatars/0.png'
const amounts = { betAmount: '$100.00', payout: '$166.67', profit: '$66.67' }

describe('betting builders (classic, pre-migration)', () => {
	afterEach(() => vi.useRealTimers())

	it('A1 pending betslip embed + confirm/cancel row', () => {
		const { embeds, components } = pendingBetslip({
			chosenTeam: 'Boston Celtics',
			opponent: 'Lakers',
			teamLabel: 'Boston Celtics',
			date: '10/5/2026 - 7:30 PM EDT',
			amounts,
			avatarUrl: avatar,
		})
		expect(embeds[0].toJSON()).toEqual({
			title: 'Pending Betslip',
			description:
				'## Boston Celtics *vs.* Lakers\n**Boston Celtics** | **10/5/2026 - 7:30 PM EDT**\n**$100.00** -> **$166.67**\n**Profit:** **$66.67**\n*Confirm your bet via the buttons below*',
			thumbnail: { url: avatar },
			color: 0xd8b21a,
		})
		expect(components[0].toJSON()).toEqual({
			type: 1,
			components: [
				{
					type: 2,
					custom_id: 'matchup_btn_confirm',
					label: 'Confirm Bet',
					style: 3,
				},
				{
					type: 2,
					custom_id: 'matchup_btn_cancel',
					label: 'Cancel Bet',
					style: 4,
				},
			],
		})
	})

	it('A2 bet confirmed', () => {
		expect(
			betConfirmedEmbed({
				betOnTeam: 'Celtics',
				opponent: 'Lakers',
				chosenTeamShort: 'Celtics',
				date: 'D',
				amounts,
				avatarUrl: avatar,
				betId: 48213,
				footer: 'foot',
			}).toJSON(),
		).toEqual({
			title: 'Bet confirmed!',
			description:
				'## Celtics *vs.* Lakers\n**Celtics** | **D**\n**$100.00** -> **$166.67**\n**Profit:** **$66.67**',
			color: 0x57f287,
			thumbnail: { url: avatar },
			footer: { text: 'Bet ID: 48213 | foot', icon_url: undefined },
		})
	})

	it('A6 public bet announcement', () => {
		expect(
			betPlacedAnnouncementEmbed({
				userId: '1',
				betOnTeam: 'Celtics',
				formattedAmount: '$100.00',
				footer: 'foot',
			}).toJSON(),
		).toEqual({
			description: '<@1> placed a bet on **Celtics** for **`$100.00`**!',
			color: 0x57f287,
			footer: { text: 'foot', icon_url: undefined },
		})
	})

	it('A7 public parlay announcement', () => {
		expect(
			parlayPlacedAnnouncementEmbed({
				userId: '1',
				parlayId: 'a3f9c2e1-7b4d',
				legCount: 3,
				stake: 25,
				potentialPayout: 172.75,
			}).toJSON(),
		).toEqual({
			description: '<@1> placed a **3-leg parlay** for **`$25.00`**!',
			color: 0x57f287,
			footer: {
				text: 'Potential payout: $172.75 • Parlay a3f9c2e1',
				icon_url: undefined,
			},
		})
	})

	it('A4 bet canceled (button)', () => {
		expect(betCanceledEmbed(avatar).toJSON()).toEqual({
			title: 'Bet Canceled',
			description: 'Your bet has been successfully cancelled.',
			color: 0xaa2d2d,
			thumbnail: { url: avatar },
		})
	})

	it('A8 /cancelbet', () => {
		expect(betCancellationEmbed(48213, avatar).toJSON()).toEqual({
			title: 'Bet Cancellation :ticket:',
			description:
				'Successfully cancelled bet `48213`\nYour funds have been restored.',
			color: 0x57f287,
			thumbnail: { url: avatar },
		})
	})

	it('A9 /doubledown', () => {
		expect(
			doubleDownEmbed({
				amount: '$200.00',
				payout: '$333.34',
				profit: '$133.34',
				balance: '$800.00',
				avatarUrl: avatar,
			}).toJSON(),
		).toEqual({
			description:
				'## Double Down\n\n**Bet:** `$200.00` | **Payout:** `$333.34`\n**Profit:** `$133.34`\n**Balance:** `$800.00`',
			color: 0x57f287,
			thumbnail: { url: avatar },
		})
	})

	it('C3 prediction placed', async () => {
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date('2026-10-04T19:30:00Z'))
		const value = await formatPredictionConfirmation(
			{ name: 'Over', description: 'Jayson Tatum', point: 27.5 },
			'player_points',
			{
				home_team: 'Boston Celtics',
				away_team: 'Los Angeles Lakers',
				commence_time: '2026-10-05T23:30:00.000Z',
			},
		)
		expect(value).toBe(
			'**⏳ Jayson Tatum** (LAL vs. BOS)\nPoints • **OVER 27.5**\n*<t:1791243000:d>*',
		)
		expect(predictionPlacedEmbed(value).toJSON()).toEqual({
			color: 0x57f287,
			title: '✅ Prediction Placed',
			description:
				'Your prediction has been recorded.\nView your predictions with `/predictions history`',
			fields: [{ name: '​', value, inline: false }],
			timestamp: '2026-10-04T19:30:00.000Z',
		})
	})

	it('C3 team prediction uses the short team name', async () => {
		expect(
			await formatPredictionConfirmation(
				{ name: 'Boston Celtics', point: -3.5 },
				'spreads',
				{
					home_team: 'Boston Celtics',
					away_team: 'Los Angeles Lakers',
					commence_time: '2026-10-05T23:30:00.000Z',
				},
			),
		).toBe(
			'**⏳ Celtics**\nSpreads • **BOSTON CELTICS -3.5**\n*<t:1791243000:d>*',
		)
	})

	it('formatMatchDate forces Eastern Time', () => {
		expect(formatMatchDate('2026-10-05T23:30:00.000Z')).toBe(
			'10/5/2026 - 7:30 PM EDT',
		)
		expect(formatMatchDate(undefined)).toBe('TBD')
	})
})
