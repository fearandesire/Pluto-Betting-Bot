import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../api/Khronos/KhronosInstances.js', () => ({
	GuildsInstance: { getGuildById: vi.fn() },
	KH_API_CONFIG: { basePath: 'https://khronos.invalid', headers: {} },
}))

import { GuildsInstance } from '../../../api/Khronos/KhronosInstances.js'
import { ChannelPresentationClient } from '../channel-presentation-client.js'

const client = new ChannelPresentationClient()

describe('ChannelPresentationClient', () => {
	beforeEach(() => vi.resetAllMocks())

	it('loads current preferred teams for delivery-time eligibility checks', async () => {
		vi.mocked(GuildsInstance.getGuildById).mockResolvedValue({
			sport: 'NBA',
			config: [
				{
					setting_type: 'BETTING_CHAN',
					setting_value: 'bets',
				},
				{
					setting_type: 'GAMES_CATEGORY',
					setting_value: 'category',
				},
				{
					setting_type: 'PREFERRED_TEAMS',
					setting_value: ' Boston Celtics, Detroit Pistons ',
				},
				{
					setting_type: 'GAME_CHANNEL_TOPIC',
					setting_value: 'Talk the game here',
				},
			],
		} as unknown as Awaited<ReturnType<typeof GuildsInstance.getGuildById>>)

		await expect(client.guild('guild')).resolves.toMatchObject({
			guildId: 'guild',
			sport: 'nba',
			preferredTeams: ['Boston Celtics', 'Detroit Pistons'],
			gameChannelTopic: 'Talk the game here',
		})
		expect(GuildsInstance.getGuildById).toHaveBeenCalledWith({
			id: 'guild',
		})
	})

	it('treats an unset preferred-team list as no restriction', async () => {
		vi.mocked(GuildsInstance.getGuildById).mockResolvedValue({
			sport: 'NBA',
			config: [
				{
					setting_type: 'BETTING_CHAN',
					setting_value: 'bets',
				},
				{
					setting_type: 'GAMES_CATEGORY',
					setting_value: 'category',
				},
			],
		} as unknown as Awaited<ReturnType<typeof GuildsInstance.getGuildById>>)

		const guild = await client.guild('guild')
		expect(guild).toMatchObject({ preferredTeams: [] })
		expect(guild.gameChannelTopic).toBeUndefined()
	})
})
