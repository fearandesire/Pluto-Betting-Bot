import { describe, expect, it, vi } from 'vitest'

const get = vi.fn()
const del = vi.fn()

vi.mock('../../../common/axios-config.js', () => ({
	AxiosKhronosInstance: { get, delete: del },
}))

const { default: ParlayApiWrapper } = await import('../ParlayApiWrapper.js')

describe('ParlayApiWrapper', () => {
	it('fetches user parlays with pagination parameters', async () => {
		get.mockResolvedValueOnce({ data: { parlays: [], page: 2 } })

		const result = await new ParlayApiWrapper().getUserParlays('user/1', {
			page: 2,
			limit: 25,
			status: 'pending',
		})

		expect(result.parlays).toEqual([])
		expect(get).toHaveBeenCalledWith(
			'/parlays/user/user%2F1',
			expect.objectContaining({
				params: { page: 2, limit: 25, status: 'pending' },
			}),
		)
	})

	it('cancels a parlay with an ownership payload', async () => {
		del.mockResolvedValueOnce({
			data: { id: 'parlay-1', status: 'cancelled' },
		})

		await new ParlayApiWrapper().cancel('parlay/1', 'user-1')

		expect(del).toHaveBeenCalledWith(
			'/parlays/parlay%2F1',
			expect.objectContaining({ data: { user_id: 'user-1' } }),
		)
	})
})
