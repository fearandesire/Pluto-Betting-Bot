import type { MatchDetailDto } from '@kh-openapi'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Must be hoisted above imports so module-level `new MatchCacheService()` gets the mock
const mockGetMatch = vi.fn<[string], Promise<MatchDetailDto | null>>()

vi.mock('../../../utils/api/routes/cache/match-cache-service.js', () => ({
	default: vi.fn().mockImplementation(() => ({ getMatch: mockGetMatch })),
}))

const mockInitialize = vi.fn().mockResolvedValue(undefined)
vi.mock('../../../utils/api/Khronos/bets/BetslipsManager.js', () => ({
	BetslipManager: vi.fn().mockImplementation(() => ({
		initialize: mockInitialize,
	})),
}))

vi.mock('../../../utils/api/Khronos/bets/betslip-wrapper.js', () => ({
	default: vi.fn(),
}))

vi.mock('../../../utils/api/common/bets/BetsCacheService.js', () => ({
	BetsCacheService: vi.fn(),
}))

vi.mock('../../../utils/cache/cache-manager.js', () => ({
	CacheManager: vi.fn(),
}))

const mockBetErr = vi.fn().mockResolvedValue({ type: 'bet-error' })
const mockMaintenanceMode = vi.fn().mockResolvedValue({ type: 'maintenance' })
vi.mock('../../../utils/common/errors/global.js', () => ({
	ErrorEmbeds: {
		betErr: mockBetErr,
		maintenanceMode: mockMaintenanceMode,
	},
}))

vi.mock('resolve-team', () => ({
	teamResolver: {
		resolve: vi
			.fn()
			.mockResolvedValue({ name: 'Lakers', abbreviation: 'LAL' }),
	},
}))

vi.mock('../../../lib/startup/env.js', () => ({
	default: { MAINTENANCE_MODE: false },
}))

// Import after all mocks are established
const { UserCommand } = await import('../bet.js')

function makeInteraction(
	overrides: {
		matchSelection?: string
		team?: string
		amount?: number
		guildId?: string
		userId?: string
	} = {},
) {
	const {
		matchSelection = 'match-1',
		team = 'Lakers',
		amount = 100,
		guildId = 'guild-1',
		userId = 'user-1',
	} = overrides

	const editReply = vi.fn().mockResolvedValue(undefined)
	const deferReply = vi.fn().mockResolvedValue(undefined)

	return {
		deferReply,
		editReply,
		guildId,
		user: { id: userId },
		options: {
			getString: vi.fn((name: string) => {
				if (name === 'match') return matchSelection
				if (name === 'team') return team
				return null
			}),
			getInteger: vi.fn((name: string) => {
				if (name === 'amount') return amount
				return null
			}),
		},
	}
}

describe('UserCommand (bet)', () => {
	let command: InstanceType<typeof UserCommand>

	beforeEach(() => {
		vi.clearAllMocks()
		// Sapphire commands need minimal container context; cast to bypass constructor checks
		command = Object.create(UserCommand.prototype) as InstanceType<
			typeof UserCommand
		>
	})

	it('returns an error embed when the selected match is not in cache', async () => {
		mockGetMatch.mockResolvedValue(null)
		const interaction = makeInteraction()

		await command.chatInputRun(
			interaction as unknown as Parameters<
				typeof command.chatInputRun
			>[0],
		)

		expect(mockBetErr).toHaveBeenCalledWith(
			expect.stringContaining('unavailable'),
		)
		expect(interaction.editReply).toHaveBeenCalledWith({
			embeds: [expect.objectContaining({ type: 'bet-error' })],
		})
		expect(mockInitialize).not.toHaveBeenCalled()
	})

	it('returns an error embed when the team is not in the match', async () => {
		mockGetMatch.mockResolvedValue({
			id: 'match-1',
			home_team: 'Bulls',
			away_team: 'Heat',
			commence_time: '2025-02-05T00:00:00Z',
			sport: 'basketball_nba',
		})
		const interaction = makeInteraction({ team: 'Celtics' })

		await command.chatInputRun(
			interaction as unknown as Parameters<
				typeof command.chatInputRun
			>[0],
		)

		expect(mockBetErr).toHaveBeenCalledWith(
			expect.stringContaining('team from the chosen match'),
		)
		expect(mockInitialize).not.toHaveBeenCalled()
	})

	it('returns an error embed when the bet amount is below $1', async () => {
		mockGetMatch.mockResolvedValue({
			id: 'match-1',
			home_team: 'Lakers',
			away_team: 'Celtics',
			commence_time: '2025-02-05T00:00:00Z',
			sport: 'basketball_nba',
		})
		const interaction = makeInteraction({ amount: 0 })

		await command.chatInputRun(
			interaction as unknown as Parameters<
				typeof command.chatInputRun
			>[0],
		)

		expect(mockBetErr).toHaveBeenCalledWith(
			expect.stringContaining('at least $1'),
		)
		expect(mockInitialize).not.toHaveBeenCalled()
	})

	it('calls BetslipManager.initialize with correct event_id when team matches', async () => {
		mockGetMatch.mockResolvedValue({
			id: 'match-1',
			home_team: 'Lakers',
			away_team: 'Celtics',
			commence_time: '2025-02-05T00:00:00Z',
			sport: 'basketball_nba',
		})
		const interaction = makeInteraction({
			matchSelection: 'match-1',
			team: 'Lakers',
		})

		await command.chatInputRun(
			interaction as unknown as Parameters<
				typeof command.chatInputRun
			>[0],
		)

		expect(mockInitialize).toHaveBeenCalledWith(
			interaction,
			'user-1',
			expect.objectContaining({ event_id: 'match-1' }),
		)
	})

	it('matches teams case-insensitively via normalizeTeamName', async () => {
		mockGetMatch.mockResolvedValue({
			id: 'match-2',
			home_team: 'Los Angeles Lakers',
			away_team: 'Boston Celtics',
			commence_time: '2025-02-05T00:00:00Z',
			sport: 'basketball_nba',
		})
		// Provide team with different casing — should still match
		const interaction = makeInteraction({
			matchSelection: 'match-2',
			team: 'los angeles lakers',
		})

		await command.chatInputRun(
			interaction as unknown as Parameters<
				typeof command.chatInputRun
			>[0],
		)

		expect(mockInitialize).toHaveBeenCalled()
		expect(mockBetErr).not.toHaveBeenCalled()
	})
})
