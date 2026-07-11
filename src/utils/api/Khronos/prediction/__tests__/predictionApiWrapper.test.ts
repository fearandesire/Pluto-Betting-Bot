import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	removePrediction: vi.fn(),
	removePredictionById: vi.fn(),
}))

vi.mock('@pluto-khronos/api-client', () => ({
	AccountsApi: vi.fn().mockImplementation(function () {
		return {}
	}),
	BetslipsApi: vi.fn().mockImplementation(function () {
		return {}
	}),
	ChangelogsApi: vi.fn().mockImplementation(function () {
		return {}
	}),
	Configuration: vi.fn().mockImplementation(function () {
		return {}
	}),
	DiscordConfigApi: vi.fn().mockImplementation(function () {
		return {}
	}),
	GuildsApi: vi.fn().mockImplementation(function () {
		return {}
	}),
	MatchesApi: vi.fn().mockImplementation(function () {
		return {}
	}),
	PredictionApi: vi.fn().mockImplementation(function () {
		return mocks
	}),
}))

vi.mock('../../../../../lib/startup/env.js', () => ({
	default: {
		KH_API_URL: 'https://khronos.test',
		KH_PLUTO_CLIENT_KEY: 'test-key',
	},
}))

const { default: PredictionApiWrapper } = await import(
	'../predictionApiWrapper.js'
)

describe('PredictionApiWrapper deletion routes', () => {
	beforeEach(() => {
		mocks.removePrediction.mockReset()
		mocks.removePredictionById.mockReset()
	})

	it('uses the event-based DELETE route explicitly', async () => {
		const wrapper = new PredictionApiWrapper()
		const params = { id: 'event-1', userId: 'user-1' }

		await wrapper.deletePredictionByEvent(params)

		expect(mocks.removePrediction).toHaveBeenCalledWith(params)
		expect(mocks.removePredictionById).not.toHaveBeenCalled()
	})

	it('uses the prediction-id DELETE route explicitly', async () => {
		const wrapper = new PredictionApiWrapper()
		const params = { predictionId: 'prediction-1', userId: 'user-1' }

		await wrapper.deletePredictionById(params)

		expect(mocks.removePredictionById).toHaveBeenCalledWith(params)
		expect(mocks.removePrediction).not.toHaveBeenCalled()
	})
})
