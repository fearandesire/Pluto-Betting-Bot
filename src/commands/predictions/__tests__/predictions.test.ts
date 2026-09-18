import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetLeaderboard = vi.fn()
const mockGetActivePredictionsForUser = vi.fn()
const mockGetPredictionStats = vi.fn()

vi.mock(
	'../../../utils/api/Khronos/leaderboard/leaderboard-wrapper.js',
	() => ({
		default: vi.fn().mockImplementation(function () {
			return { getLeaderboard: mockGetLeaderboard }
		}),
	}),
)

vi.mock(
	'../../../utils/api/Khronos/prediction/predictionApiWrapper.js',
	() => ({
		default: vi.fn().mockImplementation(function () {
			return {
				getActivePredictionsForUser: mockGetActivePredictionsForUser,
			}
		}),
	}),
)

vi.mock('../../../utils/api/Khronos/stats/stats-wrapper.js', () => ({
	default: vi.fn().mockImplementation(function () {
		return { getPredictionStats: mockGetPredictionStats }
	}),
}))

vi.mock('../../../utils/api/Khronos/props/props-api-wrapper.js', () => ({
	default: vi.fn().mockImplementation(function () {
		return { getPropByUuid: vi.fn() }
	}),
}))

vi.mock('../../../utils/common/TeamInfo.js', () => ({
	default: {
		resolveTeamIdentifier: vi.fn().mockResolvedValue({
			away_team: 'AWY',
			home_team: 'HME',
		}),
	},
}))

vi.mock('../../../utils/bot_res/ClientTools.js', () => ({
	default: vi.fn().mockImplementation(function () {
		return { resolveMember: vi.fn() }
	}),
}))

vi.mock('@sapphire/discord.js-utilities', () => ({
	PaginatedMessageEmbedFields: vi.fn().mockImplementation(function () {
		return {
			setItems: vi.fn().mockReturnThis(),
			setItemsPerPage: vi.fn().mockReturnThis(),
			make: vi.fn().mockReturnValue({ run: vi.fn() }),
		}
	}),
}))

const { SlashCommandBuilder } = await import('discord.js')
const { formatStreakBadge, UserCommand } = await import('../predictions.js')
const { formatStreakLine } = await import(
	'../../../utils/predictions/streak-display.js'
)

function makeInteraction() {
	return {
		guildId: 'guild-1',
		user: { id: 'user-1', username: 'Fenix' },
		deferReply: vi.fn().mockResolvedValue(undefined),
		editReply: vi.fn().mockResolvedValue(undefined),
		options: {
			getUser: vi.fn().mockReturnValue(null),
			getString: vi.fn().mockReturnValue(null),
		},
	}
}

describe('/predictions', () => {
	let command: InstanceType<typeof UserCommand>

	beforeEach(() => {
		vi.clearAllMocks()
		command = Object.create(UserCommand.prototype) as InstanceType<
			typeof UserCommand
		>
		Object.defineProperty(command, 'container', {
			configurable: true,
			value: { logger: { error: vi.fn(), warn: vi.fn() } },
		})
	})

	it('registers guild-only history, stats, and leaderboard subcommands', () => {
		const registry = {
			registerChatInputCommand: vi.fn(),
		}
		Object.defineProperties(command, {
			name: { configurable: true, value: 'predictions' },
			description: {
				configurable: true,
				value: 'View prediction history, stats, and leaderboard',
			},
		})

		command.registerApplicationCommands(registry as never)

		expect(registry.registerChatInputCommand).toHaveBeenCalledTimes(1)
		const [builder, options] =
			registry.registerChatInputCommand.mock.calls[0]
		const json = builder(new SlashCommandBuilder()).toJSON()

		expect(json.name).toBe('predictions')
		expect(json.contexts).toEqual([0])
		expect(json.options?.map((option) => option.name)).toEqual([
			'history',
			'stats',
			'leaderboard',
		])
		expect(options.idHints).toEqual(['1298280482123026537'])
	})

	it('renders server-calculated stats and pending count', async () => {
		mockGetLeaderboard.mockResolvedValue({
			entries: [
				{
					user_id: 'user-1',
					total_predictions: 12,
					correct_predictions: 9,
					incorrect_predictions: 3,
					success_rate: 75,
					current_streak: 0,
					best_streak: 0,
					badge_tier: null,
				},
			],
			total_users: 1,
		})
		mockGetActivePredictionsForUser.mockResolvedValue([
			{ id: 'pending-1', guild_id: 'guild-1' },
			{ id: 'pending-2', guild_id: 'guild-1' },
		])

		const interaction = makeInteraction()
		await command.handleStats(interaction as never)

		expect(mockGetLeaderboard).toHaveBeenCalledWith({ guildId: 'guild-1' })
		expect(mockGetActivePredictionsForUser).toHaveBeenCalledWith({
			userId: 'user-1',
		})
		const [{ embeds }] = interaction.editReply.mock.calls.find(
			([payload]) => payload.embeds,
		) as [{ embeds: Array<{ toJSON: () => unknown }> }]
		const embed = embeds[0].toJSON() as {
			title?: string
			description?: string
			fields?: unknown[]
		}
		expect(embed.title).toBe('📊 Prediction Statistics')
		expect(embed.description).toContain('Server stats')
		expect(embed.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: 'Total Predictions',
					value: '`12`',
				}),
				expect.objectContaining({ name: 'Win Rate', value: '`75.0%`' }),
				expect.objectContaining({ name: '⏳ Pending', value: '`2`' }),
			]),
		)
	})

	it('renders current and best streak from the Khronos stats contract', async () => {
		mockGetLeaderboard.mockResolvedValue({
			entries: [
				{
					user_id: 'user-1',
					total_predictions: 12,
					correct_predictions: 9,
					incorrect_predictions: 3,
					success_rate: 75,
					current_streak: 4,
					best_streak: 7,
					badge_tier: 3,
				},
			],
			total_users: 1,
		})
		mockGetActivePredictionsForUser.mockResolvedValue([])
		mockGetPredictionStats.mockResolvedValue({
			user_id: 'user-1',
			correct_predictions: 9,
			incorrect_predictions: 3,
			total_predictions: 12,
			success_rate: 75,
			current_streak: 4,
			best_streak: 7,
			badge_tier: 3,
		})

		const interaction = makeInteraction()
		await command.handleStats(interaction as never)

		expect(mockGetPredictionStats).toHaveBeenCalledWith({
			userId: 'user-1',
			guildId: 'guild-1',
		})
		const [{ embeds }] = interaction.editReply.mock.calls.find(
			([payload]) => payload.embeds,
		) as [{ embeds: Array<{ toJSON: () => unknown }> }]
		const embed = embeds[0].toJSON() as {
			fields?: Array<{ name: string; value: string }>
		}
		expect(embed.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: '🔥 Current Streak',
					value: '`4`',
				}),
				expect.objectContaining({
					name: '🏆 Best Streak',
					value: '`7`',
				}),
				expect.objectContaining({
					name: '🏅 Streak Badge',
					value: '`🔥3`',
				}),
			]),
		)
	})

	it.each([
		[0, ''],
		[2, ''],
		[3, ' 🔥3'],
		[5, ' 🔥5'],
		[10, ' 🔥10'],
	] as const)('formats streak marker at threshold %i', (streak, expected) => {
		expect(formatStreakBadge(streak)).toBe(expected)
	})

	it('does not present unavailable stats as a broken zero streak', async () => {
		mockGetLeaderboard.mockResolvedValue({
			entries: [
				{
					user_id: 'user-1',
					total_predictions: 12,
					correct_predictions: 9,
					incorrect_predictions: 3,
					success_rate: 75,
					current_streak: 4,
					best_streak: 7,
					badge_tier: 3,
				},
			],
			total_users: 1,
		})
		mockGetActivePredictionsForUser.mockResolvedValue([])
		mockGetPredictionStats.mockRejectedValue(
			new Error('stats endpoint unavailable'),
		)

		const interaction = makeInteraction()
		await command.handleStats(interaction as never)

		const [{ embeds }] = interaction.editReply.mock.calls.find(
			([payload]) => payload.embeds,
		) as [{ embeds: Array<{ toJSON: () => unknown }> }]
		const embed = embeds[0].toJSON() as {
			description?: string
			fields?: Array<{ name: string; value: string }>
		}
		expect(embed.description).toContain(formatStreakLine(null, null))
		expect(embed.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: '🔥 Current Streak',
					value: '`Unavailable`',
				}),
				expect.objectContaining({
					name: '🏅 Streak Badge',
					value: '`Unavailable`',
				}),
			]),
		)
	})

	it('renders a fire marker in leaderboard rows at the reported tier', async () => {
		const createLeaderboardEmbed = (
			command as unknown as {
				createLeaderboardEmbed: (
					entries: unknown[],
					page: number,
				) => Promise<{ toJSON: () => { description?: string } }>
			}
		).createLeaderboardEmbed.bind(command)
		const embed = await createLeaderboardEmbed(
			[
				{
					position: 1,
					userId: 'user-1',
					score: 88,
					correctPredictions: 10,
					incorrectPredictions: 2,
					currentStreak: 5,
					bestStreak: 6,
					badgeTier: 5,
				},
			],
			1,
		)

		expect(embed.toJSON().description).toContain('user-1 🔥5')
	})

	it('returns friendly empty copy when server stats and pending data are empty', async () => {
		mockGetLeaderboard.mockResolvedValue({ entries: [], total_users: 0 })
		mockGetActivePredictionsForUser.mockResolvedValue([])

		const interaction = makeInteraction()
		await command.handleStats(interaction as never)

		expect(interaction.editReply).toHaveBeenCalledWith({
			content: "You haven't made any predictions yet.",
		})
	})

	it('does not count pending predictions from another guild', async () => {
		mockGetLeaderboard.mockResolvedValue({ entries: [], total_users: 0 })
		mockGetActivePredictionsForUser.mockResolvedValue([
			{ id: 'pending-other-guild', guild_id: 'guild-2' },
		])

		const interaction = makeInteraction()
		await command.handleStats(interaction as never)

		expect(interaction.editReply).toHaveBeenCalledWith({
			content: "You haven't made any predictions yet.",
		})
	})
})
