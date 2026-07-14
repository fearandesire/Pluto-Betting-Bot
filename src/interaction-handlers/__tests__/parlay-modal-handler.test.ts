import { beforeEach, describe, expect, it, vi } from 'vitest'

const { builderService } = vi.hoisted(() => ({
	builderService: {
		render: vi.fn(),
		renderMessage: vi.fn(),
		setStake: vi.fn(),
		addLeg: vi.fn(),
	},
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
	InteractionHandlerTypes: { ModalSubmit: 'modal-submit' },
}))

vi.mock('../../services/ParlayBuilderService.js', () => ({
	ParlayBuilderService: class {
		constructor() {
			return builderService
		}
	},
	getParlayErrorMessage: (error: unknown) =>
		error instanceof Error ? error.message : 'Unable to process parlay.',
	logParlayBuilderError: vi.fn(),
}))

vi.mock('../../utils/api/routes/cache/match-cache-service.js', () => ({
	default: vi.fn(),
}))

vi.mock('../../utils/cache/cache-manager.js', () => ({
	CacheManager: vi.fn(),
}))

const { ParlayModalHandler } = await import('../parlay-modal-handler.js')

describe('ParlayModalHandler', () => {
	beforeEach(() => vi.clearAllMocks())

	it('reports modal validation errors ephemerally without overwriting the builder', async () => {
		const message = { edit: vi.fn() }
		const interaction = {
			user: { id: 'user-1' },
			guildId: 'guild-1',
			fields: { getTextInputValue: vi.fn(() => 'not-a-number') },
			isFromMessage: vi.fn(() => true),
			message,
			replied: false,
			deferred: false,
			reply: vi.fn(),
			deferReply: vi.fn(),
			editReply: vi.fn(),
		}
		const handler = new ParlayModalHandler({} as never, {} as never)

		await handler.run(interaction as never, { kind: 'stake' })

		expect(message.edit).not.toHaveBeenCalled()
		expect(interaction.reply).toHaveBeenCalledWith({
			content: 'Stake must be a whole number. Try again.',
			flags: 64,
		})
	})
})
