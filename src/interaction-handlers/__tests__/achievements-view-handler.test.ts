import { MessageFlags } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toJsonComponents } from '../../lib/discord/v2/__tests__/v2-assert.js'

const mocks = vi.hoisted(() => ({
	env: { PROFILE_ENABLED: true },
	evaluate: vi.fn(),
	get: vi.fn(),
}))

vi.mock('@sapphire/framework', () => ({
	InteractionHandler: class {
		public none() {
			return { kind: 'none' }
		}
		public some(value: unknown) {
			return { kind: 'some', value }
		}
	},
	InteractionHandlerTypes: { Button: 'button' },
}))
vi.mock('../../lib/startup/env.js', () => ({ default: mocks.env }))
vi.mock('../../utils/logging/WinstonLogger.js', () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))
vi.mock('../../utils/api/Khronos/achievements/achievements-wrapper.js', () => ({
	default: vi.fn().mockImplementation(function () {
		return {
			evaluateUserAchievements: mocks.evaluate,
			getUserAchievements: mocks.get,
		}
	}),
}))

const { AchievementsViewHandler } = await import(
	'../achievements-view-handler.js'
)

const TARGET = '222222222222222222'
const dto = {
	user_id: TARGET,
	earned: [],
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
		settled_bets: 0,
		wins: 0,
		losses: 0,
		pushes: 0,
		net_profit: 0,
		best_win_payout: null,
		settled_predictions: 0,
		prediction_hit_rate: null,
	},
}

const makeInteraction = () => ({
	deferReply: vi.fn().mockResolvedValue(undefined),
	editReply: vi.fn().mockResolvedValue(undefined),
	guild: {
		members: { cache: new Map([[TARGET, { displayName: 'Harbor' }]]) },
	},
	client: { users: { fetch: vi.fn() } },
})

const makeHandler = () => new AchievementsViewHandler({} as never, {} as never)

const texts = (payload: unknown) =>
	(
		(toJsonComponents(payload as never)[0].components ?? []) as Array<{
			content?: string
		}>
	).map((c) => c.content ?? '')

describe('AchievementsViewHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mocks.env.PROFILE_ENABLED = true
		mocks.evaluate.mockResolvedValue(dto)
	})

	it('accepts only ach.v1.view ids', () => {
		const parse = (customId: string) =>
			makeHandler().parse({ customId } as never)
		expect(parse(`ach.v1.view.${TARGET}`)).toEqual({
			kind: 'some',
			value: { targetId: TARGET },
		})
		expect(parse(`profile.v1.share.${TARGET}.${TARGET}`)).toEqual({
			kind: 'none',
		})
		expect(parse('ach.v2.view.1')).toEqual({ kind: 'none' })
		expect(parse(`ach.v1.view.${TARGET}.x`)).toEqual({ kind: 'none' })
	})

	it("replies privately with the target's list after acknowledging", async () => {
		const interaction = makeInteraction()
		await makeHandler().run(interaction as never, { targetId: TARGET })
		expect(interaction.deferReply).toHaveBeenCalledWith({
			flags: MessageFlags.Ephemeral,
		})
		expect(mocks.evaluate).toHaveBeenCalledWith(TARGET)
		expect(texts(interaction.editReply.mock.calls[0][0])[0]).toContain(
			'Achievements: Harbor',
		)
	})

	it('answers not available when profiles are off', async () => {
		mocks.env.PROFILE_ENABLED = false
		const interaction = makeInteraction()
		await makeHandler().run(interaction as never, { targetId: TARGET })
		expect(texts(interaction.editReply.mock.calls[0][0])[0]).toMatch(
			/not available yet/,
		)
		expect(mocks.evaluate).not.toHaveBeenCalled()
	})

	it('shows a notice when both reads fail', async () => {
		mocks.evaluate.mockRejectedValue(new Error('down'))
		mocks.get.mockRejectedValue(new Error('down'))
		const interaction = makeInteraction()
		await makeHandler().run(interaction as never, { targetId: TARGET })
		expect(texts(interaction.editReply.mock.calls[0][0])[0]).toMatch(
			/Could not load achievements/,
		)
	})
})
