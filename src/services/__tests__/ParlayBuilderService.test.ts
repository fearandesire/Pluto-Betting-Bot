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
	buildParlayButtonId,
	buildParlayModalId,
	PARLAY_BUILDER_MAX_LEGS,
	PARLAY_BUILDER_TTL_SECONDS,
	parseParlayButtonId,
	parseParlayModalId,
	ParlayBuilderService,
} = await import('../ParlayBuilderService.js')

type CacheStub = {
	get: ReturnType<typeof vi.fn>
	set: ReturnType<typeof vi.fn>
	remove: ReturnType<typeof vi.fn>
	setIfAbsent?: ReturnType<typeof vi.fn>
	compareAndRemove?: ReturnType<typeof vi.fn>
	refreshIfOwned?: ReturnType<typeof vi.fn>
}

const makeCache = (): CacheStub => ({
	get: vi.fn(),
	set: vi.fn().mockResolvedValue(true),
	remove: vi.fn().mockResolvedValue(true),
})

const makeSession = (legs = 0, revision = 0) => ({
	sessionId: 'sessionA0001',
	revision,
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
	placementId: '00000000-0000-4000-8000-000000000001',
	placementPhase: 'editing' as const,
	lastPlacementResponse: null,
})

const identityOf = (session: ReturnType<typeof makeSession>) => ({
	sessionId: session.sessionId,
	revision: session.revision,
})

const useStatefulSessionCache = (cache: CacheStub) => {
	const values = new Map<string, unknown>()
	cache.get.mockImplementation((key: string) =>
		Promise.resolve(values.get(key)),
	)
	cache.set.mockImplementation((key: string, value: unknown) => {
		values.set(key, structuredClone(value))
		return Promise.resolve(true)
	})
	cache.remove.mockImplementation((key: string) => {
		values.delete(key)
		return Promise.resolve(true)
	})
	return values
}

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

	it('stores one versioned user session with the 15 minute TTL', async () => {
		const session = await service.start('user-1', 'guild-1')

		expect(cache.set).toHaveBeenCalledWith(
			'parlay-builder:guild-1:user-1',
			{
				sessionId: expect.stringMatching(/^[A-Za-z0-9_-]{12}$/),
				revision: 0,
				legs: [],
				stake: null,
				placementId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
				placementPhase: 'editing',
				lastPlacementResponse: null,
			},
			PARLAY_BUILDER_TTL_SECONDS,
		)
		expect(session.revision).toBe(0)
	})

	it('persists one stable placement identity for the builder lifecycle', async () => {
		const session = await service.start('user-1', 'guild-1')

		expect(session).toMatchObject({
			placementPhase: 'editing',
			lastPlacementResponse: null,
		})
		expect(session.placementId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
		)
	})

	it('replaces the previous builder identity and expires legacy sessions', async () => {
		const values = useStatefulSessionCache(cache)
		const first = await service.start('user-1', 'guild-1')
		const second = await service.start('user-1', 'guild-1')

		expect(second.sessionId).not.toBe(first.sessionId)
		values.set('parlay-builder:guild-2:user-2', { legs: [], stake: null })
		await expect(service.get('user-2', 'guild-2')).resolves.toBeNull()
	})

	it('rejects a stale identity without mutating the replacement builder', async () => {
		const values = useStatefulSessionCache(cache)
		const current = makeSession(2, 4)
		values.set('parlay-builder:guild-1:user-1', current)

		await expect(
			service.setStake(
				'user-1',
				'guild-1',
				{ sessionId: 'sessionOLD01', revision: 3 },
				25,
			),
		).rejects.toThrow('no longer current')
		expect(values.get('parlay-builder:guild-1:user-1')).toEqual(current)
	})

	it('rejects stale cancel and confirm actions before any side effect', async () => {
		const values = useStatefulSessionCache(cache)
		const current = { ...makeSession(2, 4), stake: 10 }
		const stale = { sessionId: current.sessionId, revision: 3 }
		values.set('parlay-builder:guild-1:user-1', current)
		cache.setIfAbsent = vi.fn().mockResolvedValue(true)

		await expect(service.clear('user-1', 'guild-1', stale)).rejects.toThrow(
			'no longer current',
		)
		await expect(
			service.reserveForPlacement('user-1', 'guild-1', stale),
		).rejects.toThrow('no longer current')

		expect(values.get('parlay-builder:guild-1:user-1')).toEqual(current)
		expect(
			cache.setIfAbsent.mock.calls.some(([key]) =>
				String(key).endsWith(':placement'),
			),
		).toBe(false)
	})

	it('allows only one concurrent mutation from the same revision', async () => {
		const values = useStatefulSessionCache(cache)
		const current = makeSession(2)
		values.set('parlay-builder:guild-1:user-1', current)

		const results = await Promise.allSettled([
			service.setStake('user-1', 'guild-1', identityOf(current), 10),
			service.setStake('user-1', 'guild-1', identityOf(current), 20),
		])

		expect(
			results.filter((result) => result.status === 'fulfilled'),
		).toHaveLength(1)
		expect(
			results.filter((result) => result.status === 'rejected'),
		).toHaveLength(1)
		expect(values.get('parlay-builder:guild-1:user-1')).toMatchObject({
			sessionId: current.sessionId,
			revision: 1,
		})
	})

	it('does not let an old remove-index control target a revised leg list', async () => {
		const values = useStatefulSessionCache(cache)
		const original = makeSession(3)
		values.set('parlay-builder:guild-1:user-1', original)

		const revised = await service.removeLeg(
			'user-1',
			'guild-1',
			identityOf(original),
			0,
		)
		await expect(
			service.removeLeg('user-1', 'guild-1', identityOf(original), 1),
		).rejects.toThrow('no longer current')

		expect(values.get('parlay-builder:guild-1:user-1')).toEqual(revised)
		expect(revised.legs.map((leg) => leg.event_id)).toEqual([
			'event-1',
			'event-2',
		])
	})

	it('rejects duplicate events and the seventh leg', async () => {
		const oneLeg = makeSession(1)
		cache.get.mockResolvedValue(oneLeg)
		await expect(
			service.addLeg('user-1', 'guild-1', identityOf(oneLeg), {
				matchId: 'event-0',
				marketKey: 'h2h',
				side: 'home',
			}),
		).rejects.toThrow('different game')

		const maxLegs = makeSession(PARLAY_BUILDER_MAX_LEGS)
		cache.get.mockResolvedValue(maxLegs)
		await expect(
			service.addLeg('user-1', 'guild-1', identityOf(maxLegs), {
				matchId: 'event-new',
				marketKey: 'h2h',
				side: 'home',
			}),
		).rejects.toThrow('at most 6')
	})

	it('resolves a home moneyline outcome from Khronos', async () => {
		const session = makeSession()
		cache.get.mockResolvedValue(session)
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

		const result = await service.addLeg(
			'user-1',
			'guild-1',
			identityOf(session),
			{
				matchId: 'event-1',
				marketKey: 'h2h',
				side: 'home',
			},
		)

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
		const session = makeSession()
		cache.get.mockResolvedValue(session)
		matchCache.getMatch.mockResolvedValue({
			id: 'event-no-sport',
			home_team: 'Home Team',
			away_team: 'Away Team',
			commence_time: '2099-01-01T00:00:00.000Z',
		})

		await expect(
			service.addLeg('user-1', 'guild-1', identityOf(session), {
				matchId: 'event-no-sport',
				marketKey: 'h2h',
				side: 'home',
			}),
		).rejects.toThrow('missing sport information')
		expect(parlayApi.getEventOutcomes).not.toHaveBeenCalled()
	})

	it('reserves a session so concurrent confirmation can only place once', async () => {
		const session = { ...makeSession(2), stake: 10 }
		cache.get.mockResolvedValue(session)
		cache.setIfAbsent = vi.fn().mockResolvedValue(true)
		cache.compareAndRemove = vi.fn().mockResolvedValue(true)

		const first = await service.reserveForPlacement(
			'user-1',
			'guild-1',
			identityOf(session),
		)
		const second = await service.reserveForPlacement(
			'user-1',
			'guild-1',
			identityOf(session),
		)

		expect(first).not.toBeNull()
		expect(second).toBeNull()
		await service.releasePlacement('user-1', 'guild-1', first?.token)
		const third = await service.reserveForPlacement(
			'user-1',
			'guild-1',
			identityOf(session),
		)
		expect(third).not.toBeNull()
		await service.releasePlacement('user-1', 'guild-1', third?.token)
	})

	it('rejects cancellation while placement owns the builder', async () => {
		cache.setIfAbsent = vi.fn().mockResolvedValue(true)
		cache.get.mockImplementation((key: string) =>
			key.endsWith(':placement')
				? Promise.resolve('active-token')
				: Promise.resolve({ ...makeSession(2), stake: 10 }),
		)

		await expect(
			service.clear('user-1', 'guild-1', identityOf(makeSession(2))),
		).rejects.toThrow('already being placed')
		expect(cache.remove).not.toHaveBeenCalledWith(
			'parlay-builder:guild-1:user-1',
		)
	})

	it('refreshes a placement lease through the cache owner check', async () => {
		cache.refreshIfOwned = vi.fn().mockResolvedValue(true)

		await expect(
			service.refreshPlacement('user-1', 'guild-1', 'owner-token'),
		).resolves.toBe(true)
		expect(cache.refreshIfOwned).toHaveBeenCalledWith(
			'parlay-builder:guild-1:user-1:placement',
			'owner-token',
			120,
		)
	})

	it('reports a lost placement lease instead of fencing a new owner', async () => {
		cache.setIfAbsent = vi.fn().mockResolvedValue(true)
		cache.refreshIfOwned = vi.fn().mockResolvedValue(false)
		await expect(
			service.refreshPlacement('user-1', 'guild-1', 'owner-token'),
		).resolves.toBe(false)

		cache.get.mockResolvedValue(false)
		await expect(
			service.clearWithPlacementToken('user-1', 'guild-1', 'owner-token'),
		).rejects.toThrow('already being placed')
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

	it('renders a Components V2 card with versioned controls', () => {
		const session = { ...makeSession(2, 7), stake: 10 }
		const response = service.render(session)
		const container = response.components?.[0]
		const json = (container as { toJSON: () => unknown }).toJSON()

		expect(response.flags).toBeDefined()
		expect(JSON.stringify(json)).toContain(
			'parlay.btn.sessionA0001.7.remove.0',
		)
		expect(JSON.stringify(json)).toContain(
			'parlay.btn.sessionA0001.7.confirm',
		)
	})

	it('round-trips only well-formed versioned control identities', () => {
		const identity = identityOf(makeSession(0, 9))
		const removeId = buildParlayButtonId(identity, 'remove', 2)
		const modalId = buildParlayModalId(identity, 'add-leg')

		expect(parseParlayButtonId(removeId)).toEqual({
			...identity,
			action: 'remove',
			index: 2,
		})
		expect(parseParlayModalId(modalId)).toEqual({
			...identity,
			kind: 'add-leg',
		})
		expect(parseParlayButtonId('parlay_btn_remove:2')).toBeNull()
		expect(
			parseParlayButtonId(`parlay.btn.${identity.sessionId}.9.remove`),
		).toBeNull()
		expect(parseParlayModalId('parlay_modal_add_leg')).toBeNull()
	})
})
