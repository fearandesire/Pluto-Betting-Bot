import { describe, expect, it, vi } from 'vitest'

vi.mock('../KhronosInstances.js', () => ({ KH_API_CONFIG: {} }))

const mocks = vi.hoisted(() => ({
	api: undefined as undefined | (new (config: unknown) => unknown),
}))

// The generated client under test is swapped per case, so the "unavailable"
// path stays covered whatever version is installed.
vi.mock('@pluto-khronos/api-client', async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>()
	return {
		...actual,
		get AchievementsApi() {
			return mocks.api
		},
	}
})

const loadWrapper = async () => {
	vi.resetModules()
	return await import('./achievements-wrapper.js')
}

const summary = {
	settled_bets: 0,
	wins: 0,
	losses: 0,
	pushes: 0,
	net_profit: 0,
	best_win_payout: null,
	settled_predictions: 0,
	prediction_hit_rate: null,
}

const body = {
	user_id: 'u1',
	earned: [
		{
			key: 'first_win',
			name: 'Opening Score',
			description: 'Win a head-to-head bet.',
			awarded_at: '2026-11-01T10:00:00.000Z',
		},
	],
	locked: [
		{
			key: 'sharp_eye',
			name: 'The Line Reader',
			description:
				'Keep a hit rate of 60% or better across at least 15 settled predictions.',
			progress: 14,
			target: 15,
		},
	],
	summary,
}

const gates = [
	{
		metric: 'settled_predictions',
		label: 'Settled predictions',
		unit: 'count',
		comparator: 'gte',
		target: 15,
		current: 20,
		met: true,
	},
	{
		metric: 'prediction_hit_rate',
		label: 'Prediction hit rate',
		unit: 'ratio',
		comparator: 'gte',
		target: 0.6,
		current: 0.55,
		met: false,
	},
]

const rawApi = (json: unknown) => {
	const evaluateRaw = vi.fn(async () => ({ raw: { json: async () => json } }))
	const getRaw = vi.fn(async () => ({ raw: { json: async () => json } }))
	const typed = vi.fn()
	class Api {
		evaluateUserAchievementsRaw = evaluateRaw
		getUserAchievementsRaw = getRaw
		evaluateUserAchievements = typed
		getUserAchievements = typed
	}
	return { Api, evaluateRaw, getRaw, typed }
}

describe('AchievementsWrapper', () => {
	it('throws a clear error when the generated client lacks AchievementsApi', async () => {
		mocks.api = undefined
		const { default: AchievementsWrapper, isAchievementsApiAvailable } =
			await loadWrapper()
		expect(isAchievementsApiAvailable()).toBe(false)
		expect(() => new AchievementsWrapper()).toThrow(
			/AchievementsApi is unavailable/,
		)
	})

	it('delegates evaluate and get to the injected client', async () => {
		const { default: AchievementsWrapper } = await loadWrapper()
		const client = {
			evaluateUserAchievements: vi.fn(async () => body),
			getUserAchievements: vi.fn(async () => body),
		}
		const wrapper = new AchievementsWrapper(client)

		await expect(wrapper.evaluateUserAchievements('u1')).resolves.toEqual(
			body,
		)
		await expect(wrapper.getUserAchievements('u1')).resolves.toEqual(body)
		expect(client.evaluateUserAchievements).toHaveBeenCalledWith('u1')
		expect(client.getUserAchievements).toHaveBeenCalledWith('u1')
	})

	it('propagates client failures', async () => {
		const { default: AchievementsWrapper } = await loadWrapper()
		const wrapper = new AchievementsWrapper({
			evaluateUserAchievements: vi.fn(async () => {
				throw new Error('boom')
			}),
			getUserAchievements: vi.fn(),
		})
		await expect(wrapper.evaluateUserAchievements('u1')).rejects.toThrow(
			'boom',
		)
	})

	it('parses a 3.16.0 response with no additive fields', async () => {
		const { Api, getRaw } = rawApi(body)
		mocks.api = Api
		const { default: AchievementsWrapper } = await loadWrapper()
		const result = await new AchievementsWrapper().getUserAchievements('u1')
		expect(getRaw).toHaveBeenCalledWith({ userId: 'u1' })
		expect(result.locked[0]).toEqual(body.locked[0])
		expect(result.locked[0].gates).toBeUndefined()
		expect(result.locked[0].kind).toBeUndefined()
	})

	it('parses the additive gates, track and kind from the raw body', async () => {
		const v2 = {
			...body,
			earned: [{ ...body.earned[0], track: 'h2h', kind: 'career' }],
			locked: [
				{
					...body.locked[0],
					track: 'predictions',
					kind: 'form',
					gates,
				},
			],
		}
		const { Api, evaluateRaw } = rawApi(v2)
		mocks.api = Api
		const { default: AchievementsWrapper } = await loadWrapper()
		const result = await new AchievementsWrapper().evaluateUserAchievements(
			'u1',
		)
		expect(evaluateRaw).toHaveBeenCalledOnce()
		expect(result.earned[0]).toMatchObject({ track: 'h2h', kind: 'career' })
		expect(result.locked[0]).toMatchObject({
			track: 'predictions',
			kind: 'form',
			gates,
		})
	})

	it('falls back to v1 rendering data when an additive field is malformed', async () => {
		const broken = {
			...body,
			locked: [
				{
					...body.locked[0],
					kind: 'platinum',
					gates: [{ metric: 'settled_predictions' }],
				},
			],
		}
		const { Api } = rawApi(broken)
		mocks.api = Api
		const { default: AchievementsWrapper } = await loadWrapper()
		const result = await new AchievementsWrapper().getUserAchievements('u1')
		expect(result.locked[0].kind).toBeUndefined()
		expect(result.locked[0].gates).toBeUndefined()
		expect(result.locked[0].progress).toBe(14)
	})

	it('rejects a body that breaks the released contract', async () => {
		const { Api } = rawApi({ ...body, summary: undefined })
		mocks.api = Api
		const { default: AchievementsWrapper } = await loadWrapper()
		await expect(
			new AchievementsWrapper().getUserAchievements('u1'),
		).rejects.toThrow()
	})

	it('uses the typed method when the raw method is missing', async () => {
		const typed = vi.fn(async () => ({
			...body,
			earned: [
				{
					...body.earned[0],
					awarded_at: new Date('2026-11-01T10:00:00Z'),
				},
			],
		}))
		class Api {
			evaluateUserAchievements = typed
			getUserAchievements = typed
		}
		mocks.api = Api
		const { default: AchievementsWrapper } = await loadWrapper()
		const result = await new AchievementsWrapper().getUserAchievements('u1')
		expect(typed).toHaveBeenCalledWith({ userId: 'u1' })
		expect(result.earned[0].awarded_at).toBe('2026-11-01T10:00:00.000Z')
	})
})
