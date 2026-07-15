import { describe, expect, it, vi } from 'vitest'

const get = vi.fn()
const del = vi.fn()
const post = vi.fn()

vi.mock('../../../common/axios-config.js', () => ({
	AxiosKhronosInstance: { get, post, delete: del },
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

	it('sends the stable placement id and reconciles a committed placement', async () => {
		post.mockResolvedValueOnce({
			data: { id: 'parlay-1', status: 'pending' },
		})
		get.mockResolvedValueOnce({
			data: { id: 'parlay-1', status: 'pending' },
		})
		const api = new ParlayApiWrapper()

		await expect(
			api.place('init-token', '7b5971d4-2f0d-4cd6-a4e5-5fdab70c701b'),
		).resolves.toMatchObject({ id: 'parlay-1' })
		await expect(
			api.findByPlacement('7b5971d4-2f0d-4cd6-a4e5-5fdab70c701b'),
		).resolves.toMatchObject({ id: 'parlay-1' })

		expect(post).toHaveBeenCalledWith(
			'/parlays/place',
			{
				init_token: 'init-token',
				placement_id: '7b5971d4-2f0d-4cd6-a4e5-5fdab70c701b',
			},
			expect.any(Object),
		)
		expect(get).toHaveBeenCalledWith(
			'/parlays/placements/7b5971d4-2f0d-4cd6-a4e5-5fdab70c701b',
			expect.any(Object),
		)
	})

	it('treats a missing placement as a completed reconciliation', async () => {
		get.mockRejectedValueOnce({ response: { status: 404 } })

		await expect(
			new ParlayApiWrapper().findByPlacement(
				'7b5971d4-2f0d-4cd6-a4e5-5fdab70c701b',
			),
		).resolves.toBeNull()
	})
})
