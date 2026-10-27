import { MessageFlags, SlashCommandBuilder } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	env: { PROFILE_ENABLED: true },
	evaluate: vi.fn(),
	get: vi.fn(),
	getProfile: vi.fn(),
	achievementsAvailable: true,
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
			if (!mocks.achievementsAvailable) {
				throw new Error('Khronos AchievementsApi is unavailable')
			}
			return {
				evaluateUserAchievements: mocks.evaluate,
				getUserAchievements: mocks.get,
			}
		}),
	}),
)

vi.mock('../../../utils/api/requests/accounts/AccountManager.js', () => ({
	AccountsWrapper: vi.fn().mockImplementation(function () {
		return { getProfile: mocks.getProfile }
	}),
}))

const { UserCommand } = await import('../profile.js')
const { expectV2Payload, toJsonComponents } = await import(
	'../../../lib/discord/v2/__tests__/v2-assert.js'
)

const INVOKER = '111111111111111111'
const TARGET = '222222222222222222'

const dto = {
	user_id: TARGET,
	earned: [
		{ key: 'a', name: 'First Win', description: '', awarded_at: 'x' },
		{ key: 'b', name: 'Parlay Pioneer', description: '', awarded_at: 'x' },
	],
	locked: [],
	summary: {
		settled_bets: 4,
		wins: 3,
		losses: 1,
		pushes: 0,
		net_profit: 50,
		best_win_payout: 80,
		settled_predictions: 0,
		prediction_hit_rate: null,
	},
}

function makeInteraction(
	opts: { target?: Record<string, unknown> | null } = {},
) {
	return {
		user: { id: INVOKER, username: 'invoker', globalName: 'Invoker' },
		guild: { members: { cache: new Map() } },
		deferReply: vi.fn().mockResolvedValue(undefined),
		editReply: vi.fn().mockResolvedValue(undefined),
		options: {
			getUser: vi.fn(() =>
				opts.target === undefined ? null : opts.target,
			),
		},
	}
}

type Interaction = ReturnType<typeof makeInteraction>

function makeCommand() {
	const command = Object.create(UserCommand.prototype) as InstanceType<
		typeof UserCommand
	>
	Object.defineProperty(command, 'container', {
		value: { logger: { warn: mocks.warn, error: mocks.error } },
	})
	return command
}

const run = (interaction: Interaction) =>
	makeCommand().chatInputRun(
		interaction as unknown as Parameters<
			InstanceType<typeof UserCommand>['chatInputRun']
		>[0],
	)

function firstText(payload: unknown): string | undefined {
	const [container] = toJsonComponents(payload as never) as Array<{
		components?: Array<{ content?: string }>
	}>
	return container.components?.[0]?.content
}

describe('/profile', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.env.PROFILE_ENABLED = true
		mocks.achievementsAvailable = true
		mocks.evaluate.mockResolvedValue(dto)
		mocks.get.mockResolvedValue(dto)
		mocks.getProfile.mockResolvedValue({ level: 12, tier: 'Bronze' })
	})

	describe('registration', () => {
		const register = () => {
			const registry = { registerChatInputCommand: vi.fn() }
			const command = Object.create(UserCommand.prototype)
			Object.defineProperty(command, 'name', { value: 'profile' })
			Object.defineProperty(command, 'description', { value: 'Profile' })
			command.registerApplicationCommands(registry)
			return registry
		}

		it('is not registered unless PROFILE_ENABLED is true', () => {
			mocks.env.PROFILE_ENABLED = false
			expect(register().registerChatInputCommand).not.toHaveBeenCalled()
		})

		it('registers /profile with an optional user option', () => {
			const registry = register()
			expect(registry.registerChatInputCommand).toHaveBeenCalledOnce()
			const configure = registry.registerChatInputCommand.mock.calls[0][0]
			const json = configure(new SlashCommandBuilder()).toJSON()
			expect(json.name).toBe('profile')
			expect(json.options).toEqual([
				expect.objectContaining({ name: 'user', required: false }),
			])
		})
	})

	it('defers ephemerally and replies with the card and a bound share button', async () => {
		const interaction = makeInteraction({
			target: { id: TARGET, bot: false, username: 'target' },
		})
		await run(interaction)

		expect(interaction.deferReply).toHaveBeenCalledWith({
			flags: MessageFlags.Ephemeral,
		})
		expect(mocks.evaluate).toHaveBeenCalledWith(TARGET)
		expect(mocks.get).not.toHaveBeenCalled()
		expect(mocks.getProfile).toHaveBeenCalledWith(TARGET)

		const payload = interaction.editReply.mock.calls[0][0]
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 4,
		})
		expect(payload.files).toHaveLength(1)
		expect(payload.files[0].name).toBe('profile-card.png')
		expect(
			(payload.files[0].attachment as Buffer).subarray(1, 4).toString(),
		).toBe('PNG')
		const row = toJsonComponents(payload)[0].components?.slice(
			-1,
		)[0] as unknown as {
			components: Array<{ custom_id: string; disabled?: boolean }>
		}
		expect(row.components[0].custom_id).toBe(
			`profile.v1.share.${INVOKER}.${TARGET}`,
		)
	})

	it('defaults to the invoker', async () => {
		const interaction = makeInteraction()
		await run(interaction)
		expect(mocks.evaluate).toHaveBeenCalledWith(INVOKER)
	})

	it('falls back to get when evaluate fails', async () => {
		mocks.evaluate.mockRejectedValue(new Error('evaluate down'))
		const interaction = makeInteraction()
		await run(interaction)
		expect(mocks.get).toHaveBeenCalledWith(INVOKER)
		expect(interaction.editReply.mock.calls[0][0].files).toHaveLength(1)
	})

	it('still renders the card without badges when evaluate and get both fail', async () => {
		mocks.evaluate.mockRejectedValue(new Error('down'))
		mocks.get.mockRejectedValue(new Error('down'))
		const interaction = makeInteraction()
		await run(interaction)
		expect(interaction.editReply.mock.calls[0][0].files).toHaveLength(1)
	})

	it('shows an ephemeral notice when nothing can be loaded', async () => {
		mocks.evaluate.mockRejectedValue(new Error('down'))
		mocks.get.mockRejectedValue(new Error('down'))
		mocks.getProfile.mockRejectedValue(new Error('down'))
		const interaction = makeInteraction()
		await run(interaction)
		const payload = interaction.editReply.mock.calls[0][0]
		expect(payload.files).toBeUndefined()
		expect(firstText(payload)).toMatch(/Could not load/)
	})

	it('fails soft when the generated client lacks AchievementsApi', async () => {
		mocks.achievementsAvailable = false
		const interaction = makeInteraction()
		await expect(run(interaction)).resolves.toBeUndefined()
		expect(firstText(interaction.editReply.mock.calls[0][0])).toMatch(
			/not available yet/,
		)
		expect(mocks.getProfile).not.toHaveBeenCalled()
	})

	it('refuses to run while PROFILE_ENABLED is false', async () => {
		mocks.env.PROFILE_ENABLED = false
		const interaction = makeInteraction()
		await run(interaction)
		expect(firstText(interaction.editReply.mock.calls[0][0])).toMatch(
			/not available yet/,
		)
		expect(mocks.evaluate).not.toHaveBeenCalled()
	})

	it('rejects bot targets', async () => {
		const interaction = makeInteraction({
			target: { id: TARGET, bot: true, username: 'bot' },
		})
		await run(interaction)
		expect(firstText(interaction.editReply.mock.calls[0][0])).toMatch(
			/Bots do not have profiles/,
		)
		expect(mocks.evaluate).not.toHaveBeenCalled()
	})
})
