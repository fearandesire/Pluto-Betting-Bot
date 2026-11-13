import { MessageFlags, SlashCommandBuilder } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	env: { PROFILE_ENABLED: true },
	evaluate: vi.fn(),
	get: vi.fn(),
	available: true,
	warn: vi.fn(),
	error: vi.fn(),
}))

vi.mock('../../../lib/startup/env.js', () => ({ default: mocks.env }))
vi.mock('../../../utils/logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
vi.mock(
	'../../../utils/api/Khronos/achievements/achievements-wrapper.js',
	() => ({
		default: vi.fn().mockImplementation(function () {
			if (!mocks.available)
				throw new Error('AchievementsApi is unavailable')
			return {
				evaluateUserAchievements: mocks.evaluate,
				getUserAchievements: mocks.get,
			}
		}),
	}),
)

const { UserCommand } = await import('../achievements.js')
const { expectV2Payload, toJsonComponents } = await import(
	'../../../lib/discord/v2/__tests__/v2-assert.js'
)

const INVOKER = '111111111111111111'
const TARGET = '222222222222222222'

const dto = {
	user_id: TARGET,
	earned: [
		{
			key: 'first_win',
			name: 'First Win',
			description: '',
			awarded_at: 'x',
		},
	],
	locked: [
		{
			key: 'ten_wins',
			name: 'Ten Wins',
			description: '',
			progress: 4,
			target: 10,
		},
	],
	summary: {
		settled_bets: 4,
		wins: 4,
		losses: 0,
		pushes: 0,
		net_profit: 10,
		best_win_payout: 20,
		settled_predictions: 0,
		prediction_hit_rate: null,
	},
}

function makeInteraction(target?: Record<string, unknown>) {
	return {
		user: { id: INVOKER, username: 'invoker', globalName: 'Invoker' },
		guild: { members: { cache: new Map() } },
		deferReply: vi.fn().mockResolvedValue(undefined),
		editReply: vi.fn().mockResolvedValue(undefined),
		options: { getUser: vi.fn(() => target ?? null) },
	}
}

const run = (interaction: ReturnType<typeof makeInteraction>) => {
	const command = Object.create(UserCommand.prototype)
	Object.defineProperty(command, 'container', {
		value: { logger: { warn: mocks.warn, error: mocks.error } },
	})
	return command.chatInputRun(interaction)
}

const texts = (payload: unknown) =>
	(
		(toJsonComponents(payload as never)[0].components ?? []) as Array<{
			content?: string
		}>
	).map((c) => c.content ?? '')

describe('/achievements', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.env.PROFILE_ENABLED = true
		mocks.available = true
		mocks.evaluate.mockResolvedValue(dto)
		mocks.get.mockResolvedValue(dto)
	})

	describe('registration', () => {
		const register = () => {
			const registry = { registerChatInputCommand: vi.fn() }
			const command = Object.create(UserCommand.prototype)
			Object.defineProperty(command, 'name', { value: 'achievements' })
			Object.defineProperty(command, 'description', { value: 'Badges' })
			command.registerApplicationCommands(registry)
			return registry
		}

		it('does not register when profiles are off', () => {
			mocks.env.PROFILE_ENABLED = false
			expect(register().registerChatInputCommand).not.toHaveBeenCalled()
		})

		it('registers with an optional user option', () => {
			const registry = register()
			const configure = registry.registerChatInputCommand.mock.calls[0][0]
			const json = configure(new SlashCommandBuilder()).toJSON()
			expect(json.name).toBe('achievements')
			expect(json.options).toEqual([
				expect.objectContaining({ name: 'user', required: false }),
			])
		})
	})

	it('defers ephemerally before any API call, then lists the badges', async () => {
		const interaction = makeInteraction({
			id: TARGET,
			bot: false,
			username: 't',
		})
		const order: string[] = []
		interaction.deferReply.mockImplementation(async () => {
			order.push('defer')
		})
		mocks.evaluate.mockImplementation(async () => {
			order.push('evaluate')
			return dto
		})
		await run(interaction)
		expect(order).toEqual(['defer', 'evaluate'])
		expect(interaction.deferReply).toHaveBeenCalledWith({
			flags: MessageFlags.Ephemeral,
		})
		const payload = interaction.editReply.mock.calls[0][0]
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 5,
		})
		expect(texts(payload)[0]).toBe(
			'## Achievements: t\n-# 1 of 2 badges earned',
		)
		expect(texts(payload)[1]).toContain('**Opening Score**')
		expect(texts(payload)[2]).toContain('Head-to-head wins 4/10')
	})

	it('refuses bots', async () => {
		const interaction = makeInteraction({
			id: TARGET,
			bot: true,
			username: 'b',
		})
		await run(interaction)
		expect(texts(interaction.editReply.mock.calls[0][0])[0]).toMatch(
			/Bots do not have achievements/,
		)
		expect(mocks.evaluate).not.toHaveBeenCalled()
	})

	it('shows a notice when achievements cannot be loaded', async () => {
		mocks.evaluate.mockRejectedValue(new Error('down'))
		mocks.get.mockRejectedValue(new Error('down'))
		const interaction = makeInteraction()
		await run(interaction)
		expect(texts(interaction.editReply.mock.calls[0][0])[0]).toMatch(
			/Could not load achievements/,
		)
	})

	it('answers not available while profiles are off or the client lacks the API', async () => {
		mocks.env.PROFILE_ENABLED = false
		const off = makeInteraction()
		await run(off)
		expect(texts(off.editReply.mock.calls[0][0])[0]).toMatch(
			/not available yet/,
		)
		expect(mocks.evaluate).not.toHaveBeenCalled()

		mocks.env.PROFILE_ENABLED = true
		mocks.available = false
		const missing = makeInteraction()
		await run(missing)
		expect(texts(missing.editReply.mock.calls[0][0])[0]).toMatch(
			/not available yet/,
		)
	})

	it('shows Previous and Next when the 30-badge list spans pages', async () => {
		const { BADGE_PRESENTATION } = await import(
			'../../../lib/badges/badge-presentation.js'
		)
		const locked = Object.entries(BADGE_PRESENTATION).map(([key, b]) => ({
			key,
			name: b.label,
			description: b.criteria,
			kind: b.kind,
			progress: 0,
			target: 10,
			gates: [
				{
					metric: key,
					label: b.progressLabel,
					unit: 'count',
					comparator: 'gte',
					target: 10,
					current: 3,
					met: false,
				},
				{
					metric: 'distinct_events',
					label: 'Different games',
					unit: 'count',
					comparator: 'gte',
					target: 20,
					current: 7,
					met: false,
				},
			],
		}))
		mocks.evaluate.mockResolvedValue({ ...dto, earned: [], locked })
		const interaction = makeInteraction()

		await run(interaction)

		const payload = interaction.editReply.mock.calls[0][0]
		const json = JSON.stringify(toJsonComponents(payload as never))
		expect(texts(payload)[0]).toMatch(/Page 1 of [2-9]/)
		expect(json).toContain('Next')
		expect(json).toContain(`ach.v1.view.${INVOKER}.1`)
	})
})
