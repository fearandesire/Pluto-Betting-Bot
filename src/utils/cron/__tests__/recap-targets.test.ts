import { describe, expect, it, vi } from 'vitest'

vi.mock('../../logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { resolveRecapTargets } from '../recap-targets.js'

const row = (overrides: Record<string, unknown> = {}) => ({
	guild_id: 'guild-1',
	channel_id: 'channel-1',
	enabled: true,
	nba_enabled: false,
	weekly_leaderboard_enabled: false,
	monthly_leaderboard_enabled: false,
	...overrides,
})

describe('resolveRecapTargets', () => {
	it('uses settings rows and only enabled guilds with a channel', async () => {
		const result = await resolveRecapTargets(
			{
				getSettings: vi.fn(async () => [
					row({ nba_enabled: true }),
					row({ guild_id: 'guild-2', enabled: false }),
					row({ guild_id: 'guild-3', channel_id: null }),
				]),
			},
			['env-guild'],
			'env-channel',
			false,
		)

		expect(result).toEqual({
			source: 'settings',
			targets: [
				{
					guildId: 'guild-1',
					channelId: 'channel-1',
					nbaEnabled: true,
				},
			],
		})
	})

	it('does not fall back to env when every settings row is disabled', async () => {
		const result = await resolveRecapTargets(
			{
				getSettings: vi.fn(async () => [row({ enabled: false })]),
			},
			['env-guild'],
			'env-channel',
			true,
		)

		expect(result).toEqual({ source: 'settings', targets: [] })
	})

	it('falls back to the environment when Khronos has no rows', async () => {
		const result = await resolveRecapTargets(
			{ getSettings: vi.fn(async () => []) },
			['env-guild'],
			'env-channel',
			true,
		)

		expect(result).toEqual({
			source: 'env',
			targets: [
				{
					guildId: 'env-guild',
					channelId: 'env-channel',
					nbaEnabled: true,
				},
			],
		})
	})

	it('falls back to the environment when the settings read fails', async () => {
		const result = await resolveRecapTargets(
			{
				getSettings: vi.fn(async () => {
					throw new Error('Khronos is down')
				}),
			},
			['env-guild'],
			undefined,
			false,
		)

		expect(result.source).toBe('env')
		expect(result.targets).toEqual([
			{ guildId: 'env-guild', channelId: undefined, nbaEnabled: false },
		])
	})
})
