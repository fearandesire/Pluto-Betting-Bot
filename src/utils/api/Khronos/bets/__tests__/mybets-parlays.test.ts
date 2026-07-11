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
const { MyBetsPaginationService } = await import(
	'../mybets-pagination.service.js'
)

const parlay = (overrides: Record<string, unknown> = {}) => ({
	id: 'parlay-123456',
	user_id: 'user-1',
	guild_id: 'guild-1',
	stake: 10,
	combined_odds_american: 300,
	potential_payout: 40,
	actual_payout: null,
	status: 'pending' as const,
	leg_count: 3,
	created_at: '2026-07-11T12:00:00.000Z',
	settled_at: null,
	legs: [
		{
			id: 'leg-late',
			event_id: 'event-late',
			outcome_uuid: 'outcome-late',
			market_key: 'h2h' as const,
			selection_display: 'Late Team',
			odds_american: 100,
			point: null,
			commence_time: '2026-07-13T12:00:00.000Z',
			result: 'pending' as const,
			settled_at: null,
		},
		{
			id: 'leg-early',
			event_id: 'event-early',
			outcome_uuid: 'outcome-early',
			market_key: 'totals' as const,
			selection_display: 'Over 220.5',
			odds_american: -110,
			point: 220.5,
			commence_time: '2026-07-12T12:00:00.000Z',
			result: 'pending' as const,
			settled_at: null,
		},
	],
	...overrides,
})

describe('MyBetsFormatterService parlays', () => {
	const formatter = new MyBetsFormatterService()

	it('orders parlay legs by commence time and renders pending glyphs', () => {
		const line = formatter.formatPendingParlayLine(parlay())

		expect(line.indexOf('Over 220.5')).toBeLessThan(
			line.indexOf('Late Team'),
		)
		expect(line).toContain('⏳')
		expect(line).toContain('Odds: `+300`')
	})

	it('highlights the lost leg in resolved history and renders push as neutral', () => {
		const line = formatter.formatHistoryParlayLine(
			parlay({
				status: 'lost',
				actual_payout: 0,
				legs: parlay().legs.map((leg, index) => ({
					...leg,
					result: index === 0 ? ('lost' as const) : ('push' as const),
				})),
			}),
		)

		expect(line).toContain('busted')
		expect(line).toContain('❌')
		expect(line).toContain('➖')
	})

	it('only exposes pending parlays before the earliest leg starts', () => {
		const pending = parlay({
			legs: parlay().legs.map((leg) => ({
				...leg,
				commence_time: '2099-01-01T00:00:00.000Z',
			})),
		})
		const started = parlay({
			legs: parlay().legs.map((leg, index) => ({
				...leg,
				commence_time:
					index === 0
						? '2020-01-01T00:00:00.000Z'
						: '2099-01-01T00:00:00.000Z',
			})),
		})

		expect(formatter.canCancelParlay(pending)).toBe(true)
		expect(formatter.canCancelParlay(started)).toBe(false)
	})

	it('adds a cancel button for cancellable pending parlays', async () => {
		const pending = parlay({
			legs: parlay().legs.map((leg) => ({
				...leg,
				commence_time: '2099-01-01T00:00:00.000Z',
			})),
		})
		const response = await formatter.buildEmbedResponse({
			userId: 'user-1',
			pendingBets: [],
			pendingParlays: [pending],
			historyParlays: [],
			historyPage: {
				bets: [],
				parlays: [],
				entries: [],
				page: 1,
				totalPages: 1,
			},
			groupedBets: [],
		})

		expect(JSON.stringify(response.components)).toContain(
			'parlay_cancel_parlay-123456',
		)
	})
})

describe('MyBetsPaginationService parlay history', () => {
	it('fetches singles and parlays together', async () => {
		const betsWrapper = {
			getUserBetslips: vi.fn().mockResolvedValue([
				{ betresult: 'pending', dateofbet: '2026-07-11T00:00:00.000Z' },
				{ betresult: 'won', dateofbet: '2026-07-10T00:00:00.000Z' },
			]),
		}
		const parlaysWrapper = {
			getUserParlays: vi.fn().mockResolvedValue({
				parlays: [
					parlay({ status: 'pending' }),
					parlay({ status: 'lost' }),
				],
			}),
		}
		const service = new MyBetsPaginationService(
			betsWrapper as never,
			parlaysWrapper as never,
		)

		const result = await service.fetchUserBets('user-1')
		expect(result.pendingBets).toHaveLength(1)
		expect(result.historyBets).toHaveLength(1)
		expect(result.pendingParlays).toHaveLength(1)
		expect(result.historyParlays).toHaveLength(1)
	})

	it('loads every parlay API page before local history pagination', async () => {
		const betsWrapper = {
			getUserBetslips: vi.fn().mockResolvedValue([]),
		}
		const parlaysWrapper = {
			getUserParlays: vi
				.fn()
				.mockResolvedValueOnce({
					parlays: [parlay({ id: 'page-1', status: 'lost' })],
					page: 1,
					limit: 100,
					total: 201,
					total_pages: 3,
				})
				.mockResolvedValueOnce({
					parlays: [parlay({ id: 'page-2', status: 'lost' })],
					page: 2,
					limit: 100,
					total: 201,
					total_pages: 3,
				})
				.mockResolvedValueOnce({
					parlays: [parlay({ id: 'page-3', status: 'lost' })],
					page: 3,
					limit: 100,
					total: 201,
					total_pages: 3,
				}),
		}
		const service = new MyBetsPaginationService(
			betsWrapper as never,
			parlaysWrapper as never,
		)

		const result = await service.fetchUserBets('user-1')

		expect(parlaysWrapper.getUserParlays).toHaveBeenNthCalledWith(
			1,
			'user-1',
			{ page: 1, limit: 100 },
		)
		expect(parlaysWrapper.getUserParlays).toHaveBeenNthCalledWith(
			3,
			'user-1',
			{ page: 3, limit: 100 },
		)
		expect(result.historyParlays).toHaveLength(3)
	})

	it('paginates singles and parlays together in date order', () => {
		const service = new MyBetsPaginationService(
			{ getUserBetslips: vi.fn() } as never,
			{ getUserParlays: vi.fn() } as never,
		)
		const page = service.getHistoryPage(
			[
				{
					dateofbet: '2026-07-10T00:00:00.000Z',
				} as never,
			],
			1,
			[
				parlay({
					created_at: '2026-07-11T00:00:00.000Z',
					status: 'lost',
				}),
			],
		)

		expect(page.entries).toHaveLength(2)
		expect(page.entries[0]?.kind).toBe('parlay')
		expect(page.entries[1]?.kind).toBe('bet')
	})

	it('keeps mixed history chronology in the rendered embed', async () => {
		const service = new MyBetsPaginationService(
			{ getUserBetslips: vi.fn() } as never,
			{ getUserParlays: vi.fn() } as never,
		)
		const formatter = new MyBetsFormatterService()
		const bet = {
			betid: 1,
			betresult: 'won',
			team: 'SINGLE',
			amount: 10,
			payout: 20,
			profit: 10,
			dateofbet: '2026-07-10T00:00:00.000Z',
		} as never
		const newerParlay = parlay({
			created_at: '2026-07-11T00:00:00.000Z',
			status: 'lost',
		})
		const historyPage = service.getHistoryPage([bet], 1, [newerParlay])

		const embed = await formatter.buildHistoryEmbed(
			historyPage,
			service.groupBetsByDate(historyPage.bets),
		)
		const description = embed.toJSON().description ?? ''

		expect(description.indexOf('3-leg Parlay')).toBeLessThan(
			description.indexOf('SINGLE'),
		)
	})

	it('reserves the navigation row when capping cancellation buttons', async () => {
		const formatter = new MyBetsFormatterService()
		const pendingParlays = Array.from({ length: 21 }, (_, index) =>
			parlay({
				id: `parlay-${index}`,
				legs: parlay().legs.map((leg) => ({
					...leg,
					commence_time: '2099-01-01T00:00:00.000Z',
				})),
			}),
		)
		const response = await formatter.buildEmbedResponse({
			userId: 'user-1',
			pendingBets: [],
			pendingParlays,
			historyParlays: [],
			historyPage: {
				bets: [],
				parlays: [],
				entries: [],
				page: 1,
				totalPages: 2,
			},
			groupedBets: [],
		})
		const components = response.components as unknown as ReadonlyArray<{
			components?: Array<{ data?: { custom_id?: string } }>
		}>
		const cancelButtons = components
			.flatMap((row) => row.components ?? [])
			.filter((button) =>
				button.data?.custom_id?.startsWith('parlay_cancel_'),
			)

		expect(components).toHaveLength(5)
		expect(cancelButtons).toHaveLength(20)
	})
})
