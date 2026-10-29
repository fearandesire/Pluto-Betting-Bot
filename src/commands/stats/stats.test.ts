import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetPropBettingStats = vi.fn()

vi.mock('../../utils/api/Khronos/stats/stats-wrapper.js', async () => {
	class PropStatsUnavailableError extends Error {}
	return {
		PropStatsUnavailableError,
		default: vi.fn().mockImplementation(function () {
			return { getPropBettingStats: mockGetPropBettingStats }
		}),
	}
})
vi.mock('../../lib/PlutoConfig.js', () => ({
	helpfooter: vi.fn().mockResolvedValue('foot'),
}))

const { UserCommand } = await import('./stats.js')
const { PropStatsUnavailableError } = await import(
	'../../utils/api/Khronos/stats/stats-wrapper.js'
)

const logger = { warn: vi.fn(), error: vi.fn() }

function makeCommand() {
	const command = Object.create(UserCommand.prototype) as InstanceType<
		typeof UserCommand
	>
	Object.defineProperty(command, 'container', { value: { logger } })
	return command
}

function makeInteraction(sport: string | null = null) {
	return {
		guildId: 'guild-1',
		user: { id: 'user-1', username: 'Fenix' },
		deferReply: vi.fn().mockResolvedValue(undefined),
		editReply: vi.fn().mockResolvedValue(undefined),
		options: { getString: vi.fn().mockReturnValue(sport) },
	}
}

const zeroed = {
	user_id: 'user-1',
	sport: null,
	total_settled: 0,
	correct: 0,
	incorrect: 0,
	pushes: 0,
	voids: 0,
	pending: 0,
	hit_rate: null,
	markets: [],
}

describe('/stats props', () => {
	beforeEach(() => vi.clearAllMocks())

	it('defers, passes the sport filter and renders stats', async () => {
		mockGetPropBettingStats.mockResolvedValue({
			...zeroed,
			sport: 'nba',
			total_settled: 4,
			correct: 3,
			incorrect: 1,
			hit_rate: 75,
		})
		const interaction = makeInteraction('nba')
		await makeCommand().viewPropStats(interaction as never)

		expect(interaction.deferReply).toHaveBeenCalledOnce()
		expect(mockGetPropBettingStats).toHaveBeenCalledWith({
			userId: 'user-1',
			sport: 'nba',
			guildId: 'guild-1',
		})
		const [{ embeds }] = interaction.editReply.mock.calls[0] ?? []
		expect(embeds[0].title).toContain('Prop Stats (NBA)')
	})

	it('shows the empty state when nothing is settled or pending', async () => {
		mockGetPropBettingStats.mockResolvedValue(zeroed)
		const interaction = makeInteraction()
		await makeCommand().viewPropStats(interaction as never)

		expect(mockGetPropBettingStats).toHaveBeenCalledWith(
			expect.objectContaining({ sport: undefined }),
		)
		const [{ embeds }] = interaction.editReply.mock.calls[0] ?? []
		expect(embeds[0].title).toBe('❌ No Prop Stats Available')
	})

	it('fails soft with an error embed when the endpoint is unavailable', async () => {
		mockGetPropBettingStats.mockRejectedValue(
			new PropStatsUnavailableError(),
		)
		const interaction = makeInteraction()
		await makeCommand().viewPropStats(interaction as never)

		const [{ embeds }] = interaction.editReply.mock.calls[0] ?? []
		expect(embeds[0].title).toBe('⚠️ Prop Stats Unavailable')
		expect(logger.warn).toHaveBeenCalled()
	})

	it('fails soft on any other request error', async () => {
		mockGetPropBettingStats.mockRejectedValue(new Error('boom'))
		const interaction = makeInteraction()
		await makeCommand().viewPropStats(interaction as never)

		expect(logger.error).toHaveBeenCalled()
		expect(interaction.editReply).toHaveBeenCalledOnce()
	})
})
