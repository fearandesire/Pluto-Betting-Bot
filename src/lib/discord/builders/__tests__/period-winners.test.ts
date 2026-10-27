import { MessageFlags } from 'discord.js'
import { describe, expect, it } from 'vitest'
import type {
	PeriodWinner,
	PeriodWinnersResponse,
} from '../../../../utils/api/Khronos/recap/recap-wrapper.js'
import {
	expectV2Payload,
	sumTextDisplayChars,
	toJsonComponents,
} from '../../v2/__tests__/v2-assert.js'
import { periodWinnersPayload } from '../period-winners.js'

const entry = (overrides: Partial<PeriodWinner> = {}): PeriodWinner => ({
	user_id: '111',
	rank: 1,
	net_profit: 250.5,
	roi: 0.1234,
	settled_bets: 8,
	total_staked: 2000,
	...overrides,
})

const data = (
	overrides: Partial<PeriodWinnersResponse> = {},
): PeriodWinnersResponse => ({
	sport: 'nba',
	period: 'weekly',
	window: {
		start_date: '2026-07-06T00:00:00.000Z',
		end_date: '2026-07-12T23:59:59.999Z',
		label: 'Jul 6 – Jul 12',
	},
	participants: 9,
	unresolved_events: 0,
	winners: [entry()],
	leaderboard: [entry()],
	...overrides,
})

const contents = (payload: ReturnType<typeof periodWinnersPayload>) => {
	const [container] = toJsonComponents(payload) as Array<{
		components: Array<{ content?: string }>
	}>
	return container.components.map((c) => c.content ?? '')
}

describe('periodWinnersPayload', () => {
	it('renders the label, winner, ROI and leaderboard as a V2 message', () => {
		const payload = periodWinnersPayload(data())
		// container + title + winner + divider + leaderboard + divider + footer
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 7,
		})
		expect(payload.allowedMentions).toEqual({ parse: [] })
		const [title, winner, , board, , foot] = contents(payload)
		expect(title).toBe('### 🏆 NBA Weekly winners · Jul 6 – Jul 12')
		expect(winner).toBe(
			'**Winner**\n<@111> — **+250.50** · ROI 12.3% · 8 bets',
		)
		expect(board).toContain('1. <@111>')
		expect(foot).toBe('-# 9 participants · Khronos period winners · Pluto')
	})

	it('lists tied winners as co-winners', () => {
		const payload = periodWinnersPayload(
			data({
				winners: [entry(), entry({ user_id: '222', roi: null })],
				leaderboard: [entry(), entry({ user_id: '222', roi: null })],
			}),
		)
		const winner = contents(payload)[1]
		expect(winner).toContain('**Co-winners (tied at #1)**')
		expect(winner).toContain('<@111>')
		expect(winner).toContain('<@222> — **+250.50** · ROI n/a')
	})

	it('caps the leaderboard at five rows and flags unresolved events', () => {
		const rows = Array.from({ length: 8 }, (_, i) =>
			entry({ user_id: `u${i}`, rank: i + 1 }),
		)
		const payload = periodWinnersPayload(
			data({ leaderboard: rows, unresolved_events: 2 }),
		)
		const items = contents(payload)
		expect(items[3].match(/<@u/g)).toHaveLength(5)
		expect(items[items.length - 1]).toContain('2 events still unresolved')
		expect(
			sumTextDisplayChars(toJsonComponents(payload)),
		).toBeLessThanOrEqual(4000)
	})
})
