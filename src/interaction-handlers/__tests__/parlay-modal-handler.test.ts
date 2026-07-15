import { beforeEach, describe, expect, it, vi } from 'vitest'

const { builderService, matchCache } = vi.hoisted(() => ({
	builderService: {
		render: vi.fn(),
		renderMessage: vi.fn(),
		setStake: vi.fn(),
		addLeg: vi.fn(),
	},
	matchCache: { getMatch: vi.fn() },
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
	InteractionHandlerTypes: { ModalSubmit: 'modal-submit' },
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

vi.mock('../../utils/cache/cache-manager.js', () => ({
	CacheManager: vi.fn(),
}))

const { ParlayModalHandler } = await import('../parlay-modal-handler.js')
const { STALE_PARLAY_BUILDER_MESSAGE } = await import(
	'../../services/ParlayBuilderService.js'
)

describe('ParlayModalHandler', () => {
	beforeEach(() => vi.clearAllMocks())

	it('parses the builder identity from a versioned modal', () => {
		const handler = new ParlayModalHandler({} as never, {} as never)

		expect(
			handler.parse({
				customId: 'parlay.modal.sessionA0001.4.stake',
			} as never),
		).toEqual({
			kind: 'some',
			value: {
				kind: 'stake',
				sessionId: 'sessionA0001',
				revision: 4,
			},
		})
	})

	it('rejects a legacy modal as stale', async () => {
		const interaction = {
			user: { id: 'user-1' },
			guildId: 'guild-1',
			reply: vi.fn(),
		}
		const handler = new ParlayModalHandler({} as never, {} as never)

		await handler.run(interaction as never, { kind: 'legacy' })

		expect(interaction.reply).toHaveBeenCalledWith({
			content: STALE_PARLAY_BUILDER_MESSAGE,
			flags: 64,
		})
		expect(builderService.setStake).not.toHaveBeenCalled()
		expect(builderService.addLeg).not.toHaveBeenCalled()
	})

	it('passes the modal identity to the stake mutation', async () => {
		const session = {
			sessionId: 'sessionA0001',
			revision: 5,
			legs: [],
			stake: 25,
		}
		builderService.setStake.mockResolvedValueOnce(session)
		builderService.render.mockReturnValueOnce({ components: [] })
		const message = { edit: vi.fn() }
		const interaction = {
			user: { id: 'user-1' },
			guildId: 'guild-1',
			fields: { getTextInputValue: vi.fn(() => '25') },
			isFromMessage: vi.fn(() => true),
			message,
			replied: false,
			deferred: false,
			reply: vi.fn(),
			deferReply: vi.fn(),
			editReply: vi.fn(),
		}
		const handler = new ParlayModalHandler({} as never, {} as never)

		await handler.run(interaction as never, {
			kind: 'stake',
			sessionId: 'sessionA0001',
			revision: 4,
		})

		expect(builderService.setStake).toHaveBeenCalledWith(
			'user-1',
			'guild-1',
			{ sessionId: 'sessionA0001', revision: 4 },
			25,
		)
		expect(message.edit).toHaveBeenCalledWith({ components: [] })
	})

	it('reports a stale versioned modal without editing the builder message', async () => {
		builderService.setStake.mockRejectedValueOnce(
			new Error(STALE_PARLAY_BUILDER_MESSAGE),
		)
		const message = { edit: vi.fn() }
		const interaction = {
			user: { id: 'user-1' },
			guildId: 'guild-1',
			fields: { getTextInputValue: vi.fn(() => '25') },
			isFromMessage: vi.fn(() => true),
			message,
			replied: false,
			deferred: false,
			reply: vi.fn(),
			deferReply: vi.fn(),
			editReply: vi.fn(),
		}
		const handler = new ParlayModalHandler({} as never, {} as never)

		await handler.run(interaction as never, {
			kind: 'stake',
			sessionId: 'sessionA0001',
			revision: 4,
		})

		expect(message.edit).not.toHaveBeenCalled()
		expect(interaction.reply).toHaveBeenCalledWith({
			content: STALE_PARLAY_BUILDER_MESSAGE,
			flags: 64,
		})
	})

	it('passes the modal identity to the add-leg mutation', async () => {
		const session = {
			sessionId: 'sessionA0001',
			revision: 5,
			legs: [],
			stake: null,
		}
		matchCache.getMatch.mockResolvedValueOnce({ id: 'event-1' })
		builderService.addLeg.mockResolvedValueOnce(session)
		builderService.render.mockReturnValueOnce({ components: [] })
		const message = { edit: vi.fn() }
		const values = {
			parlay_game: ['event-1'],
			parlay_market: ['totals'],
			parlay_side: ['over'],
		}
		const interaction = {
			user: { id: 'user-1' },
			guildId: 'guild-1',
			fields: {
				getStringSelectValues: vi.fn(
					(id: keyof typeof values) => values[id],
				),
			},
			isFromMessage: vi.fn(() => true),
			message,
			replied: false,
			deferred: false,
			reply: vi.fn(),
			deferReply: vi.fn(),
			editReply: vi.fn(),
		}
		const handler = new ParlayModalHandler({} as never, {} as never)

		await handler.run(interaction as never, {
			kind: 'add-leg',
			sessionId: 'sessionA0001',
			revision: 4,
		})

		expect(builderService.addLeg).toHaveBeenCalledWith(
			'user-1',
			'guild-1',
			{ sessionId: 'sessionA0001', revision: 4 },
			{ matchId: 'event-1', marketKey: 'totals', side: 'over' },
		)
		expect(message.edit).toHaveBeenCalledWith({ components: [] })
	})

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

		await handler.run(interaction as never, {
			kind: 'stake',
			sessionId: 'sessionA0001',
			revision: 4,
		})

		expect(message.edit).not.toHaveBeenCalled()
		expect(interaction.reply).toHaveBeenCalledWith({
			content: 'Stake must be a whole number. Try again.',
			flags: 64,
		})
	})
})
