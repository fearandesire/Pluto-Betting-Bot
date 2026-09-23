import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
	accountCreatedEmbed,
	h2hNoStatsEmbed,
	h2hStatsEmbed,
	leaderboardPageEmbed,
	profileDescription,
	successEmbed,
	welcomeEmbed,
} from '../account.js'

const AVATAR = 'https://cdn.discordapp.com/embed/avatars/0.png'
const NOW = new Date('2026-10-04T19:30:00Z')

beforeAll(() => {
	vi.useFakeTimers({ toFake: ['Date'] })
	vi.setSystemTime(NOW)
})
afterAll(() => vi.useRealTimers())

describe('account builders (classic, pre-migration)', () => {
	it('D1/D2 successEmbed + profileDescription', () => {
		const description = profileDescription({
			balance: '$1,284.50',
			level: 7,
			tier: 'Silver',
			welcome: 'Hi',
		})
		expect(description).toBe(
			'Hi\n\n💰 **Balance:** `$1,284.50`\n🛡️ **Level:** `7`\n💫 **Tier:** `Silver`',
		)
		expect(
			profileDescription({ balance: '$1', level: 1, tier: 'Bronze' }),
		).toBe('💰 **Balance:** `$1`\n🛡️ **Level:** `1`\n💫 **Tier:** `Bronze`')
		expect(
			successEmbed({
				title: "Pluto Tester's Profile",
				description: 'd',
				footer: 'f',
				thumbnail: AVATAR,
			}).toJSON(),
		).toEqual({
			title: "Pluto Tester's Profile",
			description: 'd',
			color: 0x57f287,
			footer: { text: 'f', icon_url: undefined },
			thumbnail: { url: AVATAR },
		})
	})

	it('D3 accountCreatedEmbed', () => {
		expect(accountCreatedEmbed(100, AVATAR).toJSON()).toEqual({
			title: 'Account Created',
			description:
				'Your account has been created! You will start off with a balance of $100.\nIf you run out of money, you can get get more by claiming daily rewards from the `/dailyclaim` command.',
			color: 0x57f287,
			thumbnail: { url: AVATAR },
		})
	})

	it('D4 leaderboardPageEmbed numbers positions across pages', () => {
		expect(
			leaderboardPageEmbed(
				[{ memberTag: 'a', balance: '10.00' }],
				2,
				3,
				10,
			).toJSON(),
		).toEqual({
			title: 'Leaderboard | Page 2 of 3',
			description: '**11.** a: **`$10.00`**',
			color: 0xffac33,
			footer: { text: 'Page 2 of 3', icon_url: undefined },
		})
		expect(leaderboardPageEmbed([], 1, 1, 10).toJSON().description).toBe(
			'No entries to display.',
		)
	})

	it('D5 h2hStatsEmbed / h2hNoStatsEmbed', () => {
		const embed = h2hStatsEmbed(
			'Pluto Tester',
			{
				totalBets: 48,
				totalWins: 27,
				totalLosses: 0,
				pushes: 0,
				voids: 0,
				pending: 0,
				settled_sample: 0,
				winRate: 58.66,
				total_staked: 0,
				gross_return: 0,
				net_profit: 0,
				roi: null,
				mostBetTeam: { team: 'Lakers', count: 11 },
				mostLossesTeam: { team: 'Chiefs', losses: 0 },
				highestBetAmount: 1500,
				profitLossSummary: {
					totalWon: 3890,
					totalLost: 0,
					netProfit: 775,
				},
			},
			'foot',
		)
		expect(embed).toEqual({
			color: 0x3498db,
			title: "🎲 Pluto Tester's Betting Stats",
			fields: [
				{
					name: '📊 Totals',
					value: 'Bets: **48**\nWins: **27**\nLosses: **N/A**\nWin Rate: **58.7%**\nHighest Bet: **$1,500** 💰',
					inline: false,
				},
				{
					name: '🏆 Most Bet Team',
					value: 'Team: **Lakers**\nBets: **11**',
					inline: true,
				},
				{ name: '😅 Most Losses Team', value: 'N/A', inline: true },
				{
					name: '💵 Profit/Loss Summary',
					value: 'Total Profit: **$3,890**\nTotal Loss: **N/A**\nNet Profit: **$775**',
					inline: false,
				},
			],
			timestamp: NOW.toISOString(),
			footer: { text: 'foot' },
		})
		expect(h2hNoStatsEmbed('foot')).toEqual({
			color: 0xed4245,
			title: '❌ No Betting Stats Available',
			description:
				"You don't have enough betting history to display statistics.",
			footer: { text: 'foot' },
		})
	})

	it('D6 welcomeEmbed', () => {
		expect(welcomeEmbed('msg').toJSON()).toEqual({
			title: 'Welcome to Pluto! 🎉',
			description: 'msg',
			color: 0x5865f2,
			timestamp: NOW.toISOString(),
		})
	})
})
