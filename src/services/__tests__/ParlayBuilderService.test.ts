import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../utils/logging/WinstonLogger.js', () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

vi.mock('../../utils/api/routes/cache/match-cache-service.js', () => ({
	default: vi.fn().mockImplementation(function () {
		return { getMatch: vi.fn(), getMatches: vi.fn() }
	}),
}))

vi.mock('../../utils/api/Khronos/parlays/ParlayApiWrapper.js', () => ({
	default: vi.fn().mockImplementation(function () {
		return { getEventOutcomes: vi.fn() }
	}),
}))

vi.mock('../../utils/cache/cache-manager.js', () => ({
	CacheManager: vi.fn(),
}))

const {
	PARLAY_BUILDER_MAX_LEGS,
	PARLAY_BUILDER_TTL_SECONDS,
	ParlayBuilderService,
} = await import('../ParlayBuilderService.js')

type CacheStub = {
	get: ReturnType<typeof vi.fn>
	set: ReturnType<typeof vi.fn>
	remove: ReturnType<typeof vi.fn>
	setIfAbsent?: ReturnType<typeof vi.fn>
	compareAndRemove?: ReturnType<typeof vi.fn>
}

const makeCache = (): CacheStub => ({
	get: vi.fn(),
	set: vi.fn().mockResolvedValue(true),
	remove: vi.fn().mockResolvedValue(true),
})

const makeSession = (legs = 0) => ({
	legs: Array.from({ length: legs }, (_, index) => ({
		event_id: `event-${index}`,
		outcome_uuid: `outcome-${index}`,
		market_key: 'h2h' as const,
		selection_display: `Team ${index}`,
		odds_american: 100,
		point: null,
		commence_time: '2099-01-01T00:00:00.000Z',
	})),
	stake: null,
})

describe('ParlayBuilderService', () => {
	let cache: CacheStub
	let matchCache: { getMatch: ReturnType<typeof vi.fn> }
	let parlayApi: { getEventOutcomes: ReturnType<typeof vi.fn> }
	let service: InstanceType<typeof ParlayBuilderService>

	beforeEach(() => {
		cache = makeCache()
		matchCache = { getMatch: vi.fn() }
		parlayApi = { getEventOutcomes: vi.fn() }
		service = new ParlayBuilderService(
			cache as never,
			matchCache as never,
			parlayApi as never,
		)
	})

	it('stores one user session with the 15 minute TTL', async () => {
		await service.start('user-1', 'guild-1')

		expect(cache.set).toHaveBeenCalledWith(
			'parlay-builder:guild-1:user-1',
			{ legs: [], stake: null },
			PARLAY_BUILDER_TTL_SECONDS,
		)
	})

	it('rejects duplicate events and the seventh leg', async () => {
		cache.get.mockResolvedValue(makeSession(1))
		await expect(
			service.addLeg('user-1', 'guild-1', {
				matchId: 'event-0',
				marketKey: 'h2h',
				side: 'home',
			}),
		).rejects.toThrow('different game')

		cache.get.mockResolvedValue(makeSession(PARLAY_BUILDER_MAX_LEGS))
		await expect(
			service.addLeg('user-1', 'guild-1', {
				matchId: 'event-new',
				marketKey: 'h2h',
				side: 'home',
			}),
		).rejects.toThrow('at most 6')
	})

	it('resolves a home moneyline outcome from Khronos', async () => {
		cache.get.mockResolvedValue(makeSession())
		matchCache.getMatch.mockResolvedValue({
			id: 'event-1',
			home_team: 'Home Team',
			away_team: 'Away Team',
			sport: 'basketball_nba',
			commence_time: '2099-01-01T00:00:00.000Z',
		})
		parlayApi.getEventOutcomes.mockResolvedValue([
			{
				uuid: 'outcome-1',
				market_key: 'h2h',
				name: 'Home Team',
				price: -110,
			},
		])

		const result = await service.addLeg('user-1', 'guild-1', {
			matchId: 'event-1',
			marketKey: 'h2h',
			side: 'home',
		})

		expect(result.legs[0]).toMatchObject({
			event_id: 'event-1',
			outcome_uuid: 'outcome-1',
			selection_display: 'Home Team',
			odds_american: -110,
		})
		expect(cache.set).toHaveBeenLastCalledWith(
			'parlay-builder:guild-1:user-1',
			expect.objectContaining({ legs: expect.any(Array) }),
			PARLAY_BUILDER_TTL_SECONDS,
		)
	})

	it('rejects matches without sport metadata instead of defaulting to NBA', async () => {
		cache.get.mockResolvedValue(makeSession())
		matchCache.getMatch.mockResolvedValue({
			id: 'event-no-sport',
			home_team: 'Home Team',
			away_team: 'Away Team',
			commence_time: '2099-01-01T00:00:00.000Z',
		})

		await expect(
			service.addLeg('user-1', 'guild-1', {
				matchId: 'event-no-sport',
				marketKey: 'h2h',
				side: 'home',
			}),
		).rejects.toThrow('missing sport information')
		expect(parlayApi.getEventOutcomes).not.toHaveBeenCalled()
	})

	it('reserves a session so concurrent confirmation can only place once', async () => {
		cache.get.mockResolvedValue({ ...makeSession(2), stake: 10 })
		cache.setIfAbsent = vi.fn().mockResolvedValue(true)
		cache.compareAndRemove = vi.fn().mockResolvedValue(true)

		const first = await service.reserveForPlacement('user-1', 'guild-1')
		const second = await service.reserveForPlacement('user-1', 'guild-1')

		expect(first).not.toBeNull()
		expect(second).toBeNull()
		await service.releasePlacement('user-1', 'guild-1', first?.token)
		const third = await service.reserveForPlacement('user-1', 'guild-1')
		expect(third).not.toBeNull()
		await service.releasePlacement('user-1', 'guild-1', third?.token)
	})

	it('calculates combined odds and stake-aware payout', async () => {
		const session = {
			...makeSession(2),
			stake: 10,
		}
		const summary = service.getOddsSummary(session)

		expect(summary.decimal).toBe(4)
		expect(summary.american).toBe(300)
		expect(summary.potentialPayout).toBe(40)
	})

	it('requires two legs and a stake before placement', () => {
		expect(() => service.validateForPlacement(makeSession(1))).toThrow(
			'at least 2',
		)
		expect(() =>
			service.validateForPlacement({ ...makeSession(2), stake: null }),
		).toThrow('Set a stake')
	})

	it('renders a Components V2 card with per-leg remove controls', () => {
		const response = service.render({ ...makeSession(2), stake: 10 })
		const container = response.components?.[0]
		const json = (container as { toJSON: () => unknown }).toJSON()

		expect(response.flags).toBeDefined()
		expect(JSON.stringify(json)).toContain('parlay_btn_remove_0')
		expect(JSON.stringify(json)).toContain('parlay_btn_confirm')
	})
})
