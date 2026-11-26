import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ fetchApi: vi.fn() }))

vi.mock('../../KhronosInstances.js', async () => {
	const { Configuration } = await import('@pluto-khronos/api-client')
	return {
		KH_API_CONFIG: new Configuration({
			basePath: 'https://khronos.test/',
			headers: { 'x-api-key': 'test-key' },
			fetchApi: mocks.fetchApi,
		}),
	}
})

vi.mock('../../../../dev/index.js', () => ({
	isMockEnabled: () => false,
	MockBackend: class {},
}))

const { default: BetslipWrapper } = await import('../betslip-wrapper.js')

const betslip = (overrides: Record<string, unknown> = {}) => ({
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
	settled_at: '2026-11-21T00:00:00.000Z',
	guild_id: 'guild-1',
	...overrides,
})

const respondWith = (body: unknown) =>
	mocks.fetchApi.mockResolvedValue(
		new Response(JSON.stringify(body), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		}),
	)

describe('BetslipWrapper.getUserBetslips', () => {
	afterEach(() => {
		vi.clearAllMocks()
	})

	it('returns the refund reason Khronos sends', async () => {
		respondWith([betslip({ refund_reason: 'cancelled' })])

		const [bet] = await new BetslipWrapper().getUserBetslips({
			userid: 'user-1',
		})

		expect(bet).toMatchObject({
			betresult: 'push',
			refund_reason: 'cancelled',
		})
	})

	it('adds nothing for a betslip written before the reason existed', async () => {
		respondWith([betslip()])

		const [bet] = await new BetslipWrapper().getUserBetslips({
			userid: 'user-1',
		})

		expect(bet.refund_reason).toBeUndefined()
	})
})
