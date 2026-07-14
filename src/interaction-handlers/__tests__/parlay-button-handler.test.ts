import { beforeEach, describe, expect, it, vi } from 'vitest'

const { builderService, matchCache } = vi.hoisted(() => ({
	builderService: {
		assertCurrent: vi.fn(),
		clear: vi.fn(),
		removeLeg: vi.fn(),
		reserveForPlacement: vi.fn(),
		refreshPlacement: vi.fn(),
		validateForPlacement: vi.fn(),
		releasePlacement: vi.fn(),
		render: vi.fn(),
		renderMessage: vi.fn(),
	},
	matchCache: { getMatches: vi.fn(), getMatch: vi.fn() },
}))

vi.mock('../../utils/logging/WinstonLogger.js', () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
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

vi.mock('../../services/ParlayBuilderService.js', async (importOriginal) => {
	const original =
		await importOriginal<
			typeof import('../../services/ParlayBuilderService.js')
		>()
	return {
		...original,
		ParlayBuilderService: class {
			constructor() {
				return builderService
			}
		},
		logParlayBuilderError: vi.fn(),
	}
})

vi.mock('../../utils/api/routes/cache/match-cache-service.js', () => ({
	default: class {
		constructor() {
			return matchCache
		}
	},
}))
vi.mock('../../utils/api/Khronos/parlays/ParlayApiWrapper.js', () => ({
	default: class {},
}))
vi.mock('../../utils/api/common/bets/BetsCacheService.js', () => ({
	BetsCacheService: class {},
}))
vi.mock('../../utils/api/Khronos/bets/BetslipsManager.js', () => ({
	BetslipManager: class {},
}))
vi.mock('../../utils/api/Khronos/bets/betslip-wrapper.js', () => ({
	default: class {},
}))
vi.mock('../../utils/cache/cache-manager.js', () => ({
	CacheManager: class {},
}))

const { STALE_PARLAY_BUILDER_MESSAGE } = await import(
	'../../services/ParlayBuilderService.js'
)
const { ParlayButtonHandler } = await import('../parlay-button-handler.js')

describe('ParlayButtonHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		matchCache.getMatches.mockResolvedValue([
			{
				id: 'event-1',
				home_team: 'Home',
				away_team: 'Away',
				commence_time: '2099-01-01T00:00:00.000Z',
			},
		])
	})

	it('rejects a stale add control ephemerally without opening a modal', async () => {
		builderService.assertCurrent.mockRejectedValueOnce(
			new Error(STALE_PARLAY_BUILDER_MESSAGE),
		)
		const interaction = {
			customId: 'parlay.btn.sessionA0001.2.add',
			user: { id: 'user-1' },
			guildId: 'guild-1',
			showModal: vi.fn(),
			reply: vi.fn(),
		}
		const handler = new ParlayButtonHandler({} as never, {} as never)

		await handler.parse(interaction as never)

		expect(builderService.assertCurrent).toHaveBeenCalledWith(
			'user-1',
			'guild-1',
			{ sessionId: 'sessionA0001', revision: 2 },
		)
		expect(interaction.showModal).not.toHaveBeenCalled()
		expect(interaction.reply).toHaveBeenCalledWith({
			content: STALE_PARLAY_BUILDER_MESSAGE,
			flags: 64,
		})
	})

	it('expires legacy buttons instead of binding them to the active builder', async () => {
		const interaction = {
			customId: 'parlay_btn_remove:0',
			reply: vi.fn(),
		}
		const handler = new ParlayButtonHandler({} as never, {} as never)

		await handler.parse(interaction as never)

		expect(interaction.reply).toHaveBeenCalledWith({
			content: STALE_PARLAY_BUILDER_MESSAGE,
			flags: 64,
		})
		expect(builderService.removeLeg).not.toHaveBeenCalled()
	})

	it('carries the builder identity into the add modal', async () => {
		builderService.assertCurrent.mockResolvedValueOnce({})
		const interaction = {
			customId: 'parlay.btn.sessionA0001.2.add',
			user: { id: 'user-1' },
			guildId: 'guild-1',
			showModal: vi.fn(),
			reply: vi.fn(),
		}
		const handler = new ParlayButtonHandler({} as never, {} as never)

		await handler.parse(interaction as never)

		const modal = interaction.showModal.mock.calls[0]?.[0]
		expect(modal.toJSON().custom_id).toBe(
			'parlay.modal.sessionA0001.2.add-leg',
		)
	})

	it('passes the rendered identity to remove mutations', async () => {
		builderService.removeLeg.mockResolvedValueOnce({})
		builderService.render.mockReturnValueOnce({ components: [] })
		const interaction = {
			user: { id: 'user-1' },
			guildId: 'guild-1',
			editReply: vi.fn(),
		}
		const handler = new ParlayButtonHandler({} as never, {} as never)

		await handler.run(interaction as never, {
			action: 'remove',
			index: 0,
			sessionId: 'sessionA0001',
			revision: 2,
		})

		expect(builderService.removeLeg).toHaveBeenCalledWith(
			'user-1',
			'guild-1',
			{ sessionId: 'sessionA0001', revision: 2 },
			0,
		)
	})

	it('passes stale cancel identity to the guarded clear operation', async () => {
		builderService.clear.mockRejectedValueOnce(
			new Error(STALE_PARLAY_BUILDER_MESSAGE),
		)
		builderService.renderMessage.mockReturnValueOnce({ components: [] })
		const interaction = {
			user: { id: 'user-1' },
			guildId: 'guild-1',
			editReply: vi.fn(),
		}
		const handler = new ParlayButtonHandler({} as never, {} as never)

		await handler.run(interaction as never, {
			action: 'cancel',
			sessionId: 'sessionA0001',
			revision: 2,
		})

		expect(builderService.clear).toHaveBeenCalledWith('user-1', 'guild-1', {
			sessionId: 'sessionA0001',
			revision: 2,
		})
		expect(interaction.editReply).toHaveBeenCalledWith({
			components: [],
			flags: 32768,
		})
	})

	it('passes stale confirm identity to reservation without placing', async () => {
		builderService.reserveForPlacement.mockRejectedValueOnce(
			new Error(STALE_PARLAY_BUILDER_MESSAGE),
		)
		builderService.renderMessage.mockReturnValueOnce({ components: [] })
		const interaction = {
			user: { id: 'user-1' },
			guildId: 'guild-1',
			editReply: vi.fn(),
		}
		const handler = new ParlayButtonHandler({} as never, {} as never)

		await handler.run(interaction as never, {
			action: 'confirm',
			sessionId: 'sessionA0001',
			revision: 2,
		})

		expect(builderService.reserveForPlacement).toHaveBeenCalledWith(
			'user-1',
			'guild-1',
			{ sessionId: 'sessionA0001', revision: 2 },
		)
		expect(builderService.releasePlacement).not.toHaveBeenCalled()
	})
})
