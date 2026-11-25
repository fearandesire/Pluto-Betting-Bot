import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../logging/WinstonLogger.js', () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

vi.mock('../betslip-wrapper.js', () => ({
	default: vi.fn().mockImplementation(function () {
		return { getUserBetslips: vi.fn() }
	}),
}))

vi.mock('../../parlays/ParlayApiWrapper.js', () => ({
	default: vi.fn().mockImplementation(function () {
		return { getUserParlays: vi.fn() }
	}),
}))

const { MyBetsFormatterService } = await import(
	'../mybets-formatter.service.js'
)

const formatter = new MyBetsFormatterService()

/** A bet slip as the published 3.20.x client types it, plus any new field. */
const bet = (overrides: Record<string, unknown> = {}) =>
	({
		betid: 1,
		userid: 'user-1',
		team: 'Los Angeles Lakers',
		matchup_id: 'event-1',
		amount: 100,
		profit: 0,
		payout: 0,
		betresult: 'push',
		dateofbet: '2026-11-20',
		dateofmatchup: '2026-11-21',
		settled_at: null,
		guild_id: 'guild-1',
		...overrides,
	}) as never

describe('mybets history line for a refunded bet', () => {
	it.each([
		['cancelled', 'Game cancelled, bet voided (refunded `$100.00`)'],
		['postponed', 'Game postponed, bet voided (refunded `$100.00`)'],
		['abandoned', 'Game abandoned, bet voided (refunded `$100.00`)'],
		['void', 'Bet voided (refunded `$100.00`)'],
	])('names a game voided because %s', (refund_reason, expected) => {
		expect(formatter.formatHistoryBetLine(bet({ refund_reason }))).toBe(
			`**➖ Lakers**\nWager: \`$100.00\` • ${expected}\n*<t:1795132800:d>*`,
		)
	})

	it.each([
		['a tie', { refund_reason: 'tie' }],
		['no recorded reason', {}],
		['an explicit null', { refund_reason: null }],
		['a reason this build does not know', { refund_reason: 'suspended' }],
	])('keeps the push copy for %s', (_name, overrides) => {
		expect(formatter.formatHistoryBetLine(bet(overrides))).toContain(
			'Wager: `$100.00` • Push (refunded `$100.00`)',
		)
	})

	it('keeps the push emoji for a tie and uses the voided one for a void', () => {
		expect(
			formatter.formatHistoryBetLine(bet({ refund_reason: 'tie' })),
		).toContain('**🔄 Lakers**')
		expect(
			formatter.formatHistoryBetLine(bet({ refund_reason: 'cancelled' })),
		).toContain('**➖ Lakers**')
	})

	it('never rewrites a graded bet that carries a reason', () => {
		expect(
			formatter.formatHistoryBetLine(
				bet({
					betresult: 'won',
					payout: 250,
					profit: 150,
					refund_reason: 'cancelled',
				}),
			),
		).toBe(
			'**✅ Lakers**\nWager: `$100.00` • Won `$250.00` (+`$150.00`)\n*<t:1795132800:d>*',
		)
	})
})
