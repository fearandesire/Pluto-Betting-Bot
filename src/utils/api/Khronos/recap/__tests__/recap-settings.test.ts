import { describe, expect, it, vi } from 'vitest'

const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }))

vi.mock('../../KhronosInstances.js', () => ({
	KH_API_CONFIG: {
		basePath: 'https://khronos.test/',
		headers: { 'x-api-key': 'test-key' },
		fetchApi,
	},
}))

import RecapWrapper from '../recap-wrapper.js'

function wrapper() {
	return new RecapWrapper({
		getWeeklyRecap: vi.fn(),
	})
}

describe('RecapWrapper.getSettings', () => {
	it('reads the settings list and normalizes booleans', async () => {
		fetchApi.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => [
				{
					guild_id: 'guild-1',
					channel_id: 'channel-1',
					enabled: true,
					nba_enabled: true,
					weekly_leaderboard_enabled: true,
					monthly_leaderboard_enabled: false,
					updated_at: '2026-11-15T00:00:00.000Z',
					updated_by: 'user_1',
				},
			],
		})

		await expect(wrapper().getSettings()).resolves.toEqual([
			{
				guild_id: 'guild-1',
				channel_id: 'channel-1',
				enabled: true,
				nba_enabled: true,
				weekly_leaderboard_enabled: true,
				monthly_leaderboard_enabled: false,
				updated_at: '2026-11-15T00:00:00.000Z',
				updated_by: 'user_1',
			},
		])
		expect(fetchApi).toHaveBeenCalledWith(
			'https://khronos.test/api/khronos/v1/recap/settings',
			expect.objectContaining({
				method: 'GET',
				headers: expect.objectContaining({
					Accept: 'application/json',
				}),
			}),
		)
	})

	it('fails closed on a non-success response', async () => {
		fetchApi.mockResolvedValueOnce({ ok: false, status: 503 })

		await expect(wrapper().getSettings()).rejects.toThrow(
			/Khronos recap settings request failed \(503\)/,
		)
	})

	it('rejects a payload that is not an array', async () => {
		fetchApi.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ rows: [] }),
		})

		await expect(wrapper().getSettings()).rejects.toThrow(
			/invalid recap settings payload/,
		)
	})
})
