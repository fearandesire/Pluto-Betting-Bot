import { beforeEach, describe, expect, it, vi } from 'vitest'

const { builderService, matchCache, parlayAnnouncement, parlayApi } =
	vi.hoisted(() => ({
		builderService: {
			assertCurrent: vi.fn(),
			clear: vi.fn(),
			clearWithPlacementToken: vi.fn(),
			removeLeg: vi.fn(),
			reserveForPlacement: vi.fn(),
			refreshPlacement: vi.fn(),
			setPlacementState: vi.fn(),
			validateForPlacement: vi.fn(),
			releasePlacement: vi.fn(),
			render: vi.fn(),
			renderMessage: vi.fn(),
		},
		parlayApi: {
			init: vi.fn(),
			place: vi.fn(),
			findByPlacement: vi.fn(),
		},
		parlayAnnouncement: { announceParlayPlaced: vi.fn() },
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
	default: class {
		constructor() {
			return parlayApi
		}
	},
}))
vi.mock('../../utils/api/common/bets/BetsCacheService.js', () => ({
	BetsCacheService: class {},
}))
vi.mock('../../utils/api/Khronos/bets/BetslipsManager.js', () => ({
	BetslipManager: class {
		constructor() {
			return parlayAnnouncement
		}
	},
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
		const session = {
			sessionId: 'sessionA0001',
			revision: 2,
			legs: [
				{ event_id: 'event-1', outcome_uuid: 'outcome-1' },
				{ event_id: 'event-2', outcome_uuid: 'outcome-2' },
			],
			stake: 10,
			placementId: '00000000-0000-4000-8000-000000000001',
			placementPhase: 'editing',
			lastPlacementResponse: null,
		}
		builderService.assertCurrent.mockResolvedValue(session)
		builderService.reserveForPlacement.mockResolvedValue({
			session: { ...session, placementPhase: 'placing' },
			token: 'placement-token',
		})
		builderService.refreshPlacement.mockResolvedValue(true)
		builderService.setPlacementState.mockImplementation(
			async (
				_userId,
				_guildId,
				_expected,
				placementPhase,
				response = null,
			) => ({
				...session,
				placementPhase,
				lastPlacementResponse: response,
			}),
		)
		builderService.clear.mockResolvedValue(undefined)
		builderService.clearWithPlacementToken.mockResolvedValue(undefined)
		builderService.releasePlacement.mockResolvedValue(undefined)
		builderService.validateForPlacement.mockReturnValue(undefined)
		builderService.renderMessage.mockReturnValue({ components: [] })
		parlayAnnouncement.announceParlayPlaced.mockResolvedValue(undefined)
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

	it('rejects a stale cancel identity before it clears the builder', async () => {
		builderService.assertCurrent.mockRejectedValueOnce(
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

		expect(builderService.clear).not.toHaveBeenCalled()
		expect(interaction.editReply).toHaveBeenCalledWith({
			components: [],
			flags: 32768,
		})
	})

	it('rejects a stale confirm identity before it reserves placement', async () => {
		builderService.assertCurrent.mockRejectedValueOnce(
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

		expect(builderService.reserveForPlacement).not.toHaveBeenCalled()
		expect(builderService.releasePlacement).not.toHaveBeenCalled()
	})

	it('reconciles a timeout after Khronos committed and renders one placement', async () => {
		parlayApi.init.mockResolvedValueOnce({ init_token: 'init-token' })
		parlayApi.place.mockRejectedValueOnce(new Error('socket timeout'))
		parlayApi.findByPlacement.mockResolvedValueOnce({
			id: 'parlay-1',
			leg_count: 2,
			stake: 10,
			potential_payout: 40,
			combined_odds_american: 300,
		})
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

		expect(parlayApi.place).toHaveBeenCalledWith(
			'init-token',
			'00000000-0000-4000-8000-000000000001',
		)
		expect(parlayApi.findByPlacement).toHaveBeenCalledWith(
			'00000000-0000-4000-8000-000000000001',
		)
		expect(builderService.setPlacementState).toHaveBeenCalledWith(
			'user-1',
			'guild-1',
			{ sessionId: 'sessionA0001', revision: 2 },
			'unknown',
		)
		expect(interaction.editReply).toHaveBeenCalledWith({ components: [] })
	})

	it('renders placement success even when lease cleanup fails after a response', async () => {
		parlayApi.init.mockResolvedValueOnce({ init_token: 'init-token' })
		parlayApi.place.mockResolvedValueOnce({
			id: 'parlay-1',
			leg_count: 2,
			stake: 10,
			potential_payout: 40,
			combined_odds_american: 300,
		})
		builderService.clearWithPlacementToken.mockRejectedValueOnce(
			new Error('lost lease'),
		)
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

		expect(interaction.editReply).toHaveBeenCalledWith({ components: [] })
		expect(builderService.releasePlacement).toHaveBeenCalledWith(
			'user-1',
			'guild-1',
			'placement-token',
		)
	})

	it('prevents a second replica from placing while the first holds the reservation', async () => {
		parlayApi.init.mockResolvedValue({ init_token: 'init-token' })
		parlayApi.place.mockResolvedValue({
			id: 'parlay-1',
			leg_count: 2,
			stake: 10,
			potential_payout: 40,
			combined_odds_american: 300,
		})
		builderService.reserveForPlacement
			.mockResolvedValueOnce({
				session: {
					sessionId: 'sessionA0001',
					revision: 2,
					legs: [
						{ event_id: 'event-1', outcome_uuid: 'outcome-1' },
						{ event_id: 'event-2', outcome_uuid: 'outcome-2' },
					],
					stake: 10,
					placementId: '00000000-0000-4000-8000-000000000001',
					placementPhase: 'placing',
					lastPlacementResponse: null,
				},
				token: 'placement-token',
			})
			.mockResolvedValueOnce(null)
		const first = {
			user: { id: 'user-1' },
			guildId: 'guild-1',
			editReply: vi.fn(),
		}
		const second = {
			user: { id: 'user-1' },
			guildId: 'guild-1',
			editReply: vi.fn(),
		}
		const handler = new ParlayButtonHandler({} as never, {} as never)
		const payload = {
			action: 'confirm' as const,
			sessionId: 'sessionA0001',
			revision: 2,
		}

		await Promise.all([
			handler.run(first as never, payload),
			handler.run(second as never, payload),
		])

		expect(parlayApi.place).toHaveBeenCalledTimes(1)
	})

	it('reconciles an unknown placement before cancellation clears the builder', async () => {
		builderService.assertCurrent.mockResolvedValueOnce({
			sessionId: 'sessionA0001',
			revision: 2,
			placementId: '00000000-0000-4000-8000-000000000001',
			placementPhase: 'unknown',
			lastPlacementResponse: null,
		})
		parlayApi.findByPlacement.mockResolvedValueOnce(null)
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

		expect(parlayApi.findByPlacement).toHaveBeenCalledWith(
			'00000000-0000-4000-8000-000000000001',
		)
		expect(builderService.setPlacementState).toHaveBeenCalledWith(
			'user-1',
			'guild-1',
			{ sessionId: 'sessionA0001', revision: 2 },
			'editing',
		)
		expect(builderService.clear).toHaveBeenCalledWith('user-1', 'guild-1', {
			sessionId: 'sessionA0001',
			revision: 2,
		})
	})
})
