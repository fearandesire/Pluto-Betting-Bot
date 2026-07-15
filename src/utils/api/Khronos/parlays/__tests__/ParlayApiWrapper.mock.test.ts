import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockBackend = {
	initParlay: vi.fn(),
	placeParlay: vi.fn(),
	getUserParlays: vi.fn(),
	cancelParlay: vi.fn(),
	getEventOutcomes: vi.fn(),
}

vi.mock('../../../../dev/index.js', () => ({
	MockBackend: { instance: () => mockBackend },
}))

vi.mock('../../../common/axios-config.js', () => ({
	AxiosKhronosInstance: { post: vi.fn(), get: vi.fn(), delete: vi.fn() },
}))

const { default: ParlayApiWrapper } = await import('../ParlayApiWrapper.js')

describe('ParlayApiWrapper mock mode', () => {
	beforeEach(() => {
		vi.stubEnv('USE_MOCK_DATA', 'true')
		vi.clearAllMocks()
	})

	it('routes parlay initialization through MockBackend', async () => {
		const response = { init_token: 'mock-token' }
		mockBackend.initParlay.mockReturnValue(response)

		await expect(
			new ParlayApiWrapper().init({
				legs: [],
				stake: 10,
				guild_id: 'guild-1',
				user_id: 'user-1',
			}),
		).resolves.toBe(response)
		expect(mockBackend.initParlay).toHaveBeenCalledOnce()
	})

	it('routes outcome lookup through MockBackend', async () => {
		const response = [{ uuid: 'outcome-1' }]
		mockBackend.getEventOutcomes.mockReturnValue(response)

		await expect(
			new ParlayApiWrapper().getEventOutcomes('nba', 'event-1'),
		).resolves.toBe(response)
		expect(mockBackend.getEventOutcomes).toHaveBeenCalledWith(
			'nba',
			'event-1',
		)
	})
})
