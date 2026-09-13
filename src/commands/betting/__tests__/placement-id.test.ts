import { PatreonDataDtoToJSON } from '@pluto-khronos/api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ButtonHandler } from '../../../interaction-handlers/ButtonListener.js'
import { BetsCacheService } from '../../../utils/api/common/bets/BetsCacheService.js'
import { BetslipManager } from '../../../utils/api/Khronos/bets/BetslipsManager.js'
import BetslipWrapper from '../../../utils/api/Khronos/bets/betslip-wrapper.js'

vi.mock('../../../utils/common/errors/global.js', () => ({
	ErrorEmbeds: {
		internalErr: vi.fn().mockResolvedValue({}),
	},
}))

vi.mock('@pluto-config', () => ({
	betFooter: vi.fn().mockReturnValue(''),
	supportMessage: '',
}))

vi.mock('../../../utils/logging/WinstonLogger.js', () => ({
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
		info: vi.fn(),
	},
}))

vi.mock('../../../utils/api/Khronos/KhronosInstances.js', () => ({
	KH_API_CONFIG: { basePath: 'http://localhost' },
}))

vi.mock('../../../utils/dev/index.js', () => ({
	isMockEnabled: vi.fn().mockReturnValue(false),
	MockBackend: { instance: vi.fn() },
}))

vi.mock('../../../utils/api/common/handleNewUser.js', () => ({
	handleNewUser: vi.fn(),
}))

vi.mock('../../../utils/guilds/GuildUtils.js', () => ({
	default: class {
		findEmoji = vi.fn().mockResolvedValue('')
	},
}))

vi.mock('../../../utils/common/string-utils.js', () => ({
	default: class {
		getShortName = vi.fn().mockReturnValue('TEAM')
	},
}))

vi.mock('../../../utils/cache/redis-instance.js', () => ({
	default: {
		set: vi.fn(),
		get: vi.fn(),
		del: vi.fn(),
		flushall: vi.fn(),
		exists: vi.fn(),
		incr: vi.fn(),
		decr: vi.fn(),
		expire: vi.fn(),
		setex: vi.fn(),
		ttl: vi.fn(),
		hset: vi.fn(),
		hgetall: vi.fn(),
		sadd: vi.fn(),
		smembers: vi.fn(),
		pipeline: vi.fn(),
		compareAndRemove: vi.fn(),
		refreshIfOwned: vi.fn(),
		transitionIfValue: vi.fn(),
	},
}))

vi.mock('../../../lib/startup/pluto.js', () => ({
	startPluto: vi.fn(),
}))

vi.mock('../../../utils/api/patreon/Patreon-Facade.js', () => ({
	default: class {
		static isSponsorTier = vi.fn().mockResolvedValue(false)
	},
}))

describe('H2H placement identity', () => {
	const set = vi.fn()
	const get = vi.fn()
	const remove = vi.fn()
	let service: BetsCacheService

	beforeEach(() => {
		vi.clearAllMocks()
		service = new BetsCacheService({ set, get, remove } as never)
	})

	it('retains one generated placement id through cache and API sanitization', async () => {
		await service.cacheUserBet('user-1', {
			userid: 'user-1',
			team: 'Lakers',
			amount: 80,
			match: { id: 'event-1' },
			opponent: 'Celtics',
			dateofmatchup: '2026-09-14T00:00:00.000Z',
			profit: 120,
			payout: 200,
			guild_id: 'guild-1',
		} as never)

		const cached = set.mock.calls[0]?.[1]
		expect(cached.placement_id).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		)

		const sanitized = await service.sanitize(cached)
		expect(sanitized).toMatchObject({
			placement_id: cached.placement_id,
			event_id: 'event-1',
		})
	})

	it('atomically upgrades a legacy cache entry to one placement id', async () => {
		let stored: Record<string, unknown> = {
			userid: 'user-1',
			team: 'Lakers',
			amount: 80,
			event_id: 'event-1',
			matchup_id: 'event-1',
		}
		const transitionIfValue = vi.fn(async (_key, expected, next) => {
			if (JSON.stringify(stored) !== JSON.stringify(expected))
				return false
			stored = next
			return true
		})
		const concurrentService = new BetsCacheService({
			get: vi.fn(async () => stored),
			set,
			remove,
			transitionIfValue,
		} as never)

		const [first, second] = await Promise.all([
			concurrentService.getUserBet('user-1'),
			concurrentService.getUserBet('user-1'),
		])

		expect(first?.placement_id).toBe(second?.placement_id)
		expect(transitionIfValue).toHaveBeenCalledTimes(2)
	})

	it('regenerates placement identity when the selection changes', async () => {
		const existing = {
			placement_id: '00000000-0000-4000-8000-000000000011',
			team: 'Lakers',
			amount: 80,
			event_id: 'event-1',
			matchup_id: 'event-1',
		} as { placement_id: string }
		get.mockResolvedValue(existing)

		await service.updateUserBet('user-1', { team: 'Celtics' })

		const updated = set.mock.calls[0]?.[1]
		expect(updated.team).toBe('Celtics')
		expect(updated.placement_id).not.toBe(existing.placement_id)
	})

	it('forwards placement_id in the generated request body', async () => {
		const wrapper = new BetslipWrapper()
		const placeBetslip = vi.fn(async (payload, transform) => {
			const transformed = await transform({
				init: { body: JSON.stringify(payload.placeBetDto) },
			})
			return JSON.parse(String(transformed.body))
		})
		;(wrapper as never as { betslipApi: unknown }).betslipApi = {
			placeBetslip,
		}

		const response = await wrapper.finalize({
			placeBetDto: {
				placement_id: '00000000-0000-4000-8000-000000000012',
			} as never,
		})

		expect(placeBetslip).toHaveBeenCalled()
		expect(response).toMatchObject({
			placement_id: '00000000-0000-4000-8000-000000000012',
		})
	})

	it('keeps the confirmation control for transient placement failures', async () => {
		const finalize = vi.fn().mockResolvedValue({ statusCode: 503 })
		const clearUserBet = vi.fn()
		const manager = new BetslipManager(
			{ finalize } as never,
			{ clearUserBet } as never,
		)
		const editReply = vi.fn()

		await manager.placeBet(
			{
				deferred: true,
				replied: false,
				editReply,
				followUp: vi.fn(),
				user: { displayAvatarURL: () => 'avatar' },
			} as never,
			{} as never,
			{} as never,
		)
		finalize.mockRejectedValueOnce(new Error('network unavailable'))
		await manager.placeBet(
			{
				deferred: true,
				replied: false,
				editReply,
				followUp: vi.fn(),
				user: { displayAvatarURL: () => 'avatar' },
			} as never,
			{} as never,
			{} as never,
		)

		expect(editReply).toHaveBeenLastCalledWith(
			expect.not.objectContaining({ components: [] }),
		)
		expect(clearUserBet).not.toHaveBeenCalled()
	})

	it('keeps the confirmation control after a rate-limit response', async () => {
		const finalize = vi.fn().mockResolvedValue({ statusCode: 429 })
		const manager = new BetslipManager(
			{ finalize } as never,
			{ clearUserBet: vi.fn() } as never,
		)
		const editReply = vi.fn()
		const bet = { userid: 'user-1', placement_id: 'placement-429' }

		await manager.placeBet(
			{
				deferred: true,
				replied: false,
				editReply,
				followUp: vi.fn(),
				user: { displayAvatarURL: () => 'avatar' },
			} as never,
			bet as never,
			{} as never,
		)

		expect(editReply).toHaveBeenCalledWith(
			expect.not.objectContaining({ components: [] }),
		)
		expect(finalize).toHaveBeenCalledWith({ placeBetDto: bet })
	})

	it('removes the confirmation control for definitive business failures', async () => {
		const manager = new BetslipManager(
			{
				finalize: vi.fn().mockResolvedValue({ statusCode: 409 }),
			} as never,
			{ clearUserBet: vi.fn() } as never,
		)
		const editReply = vi.fn()

		await manager.placeBet(
			{
				deferred: true,
				replied: false,
				editReply,
				followUp: vi.fn(),
				user: { displayAvatarURL: () => 'avatar' },
			} as never,
			{} as never,
			{} as never,
		)

		expect(editReply).toHaveBeenCalledWith(
			expect.objectContaining({ components: [] }),
		)
	})

	it('keeps the cached placement id until a placement succeeds', async () => {
		const clearUserBet = vi.fn()
		const finalize = vi
			.fn()
			.mockRejectedValueOnce(new Error('network unavailable'))
			.mockResolvedValueOnce({
				statusCode: 201,
				betslip: {
					team: 'Lakers',
					amount: 80,
					profit: 120,
					payout: 200,
					betid: 1,
					newBalance: 20,
				},
			})
		const manager = new BetslipManager(
			{ finalize } as never,
			{ clearUserBet } as never,
		)
		vi.spyOn(manager, 'successfulBetEmbed').mockResolvedValue({} as never)
		const interaction = {
			deferred: true,
			replied: false,
			editReply: vi.fn(),
			followUp: vi.fn(),
			user: { displayAvatarURL: () => 'avatar' },
			guildId: undefined,
		}
		const bet = { userid: 'user-1', placement_id: 'placement-1' } as never

		await manager.placeBet(interaction as never, bet, {} as never)
		await manager.placeBet(interaction as never, bet, {} as never)

		expect(finalize.mock.calls[0]?.[0].placeBetDto.placement_id).toBe(
			'placement-1',
		)
		expect(finalize.mock.calls[1]?.[0].placeBetDto.placement_id).toBe(
			'placement-1',
		)
		expect(clearUserBet).toHaveBeenCalledTimes(1)
	})

	it('passes the interaction guild when cancelling a wager', async () => {
		const cancel = vi.fn().mockResolvedValue({})
		const manager = new BetslipManager({ cancel } as never, {} as never)
		const interaction = {
			deferred: true,
			replied: false,
			guildId: 'guild-1',
			user: {
				id: 'user-1',
				displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png',
			},
			followUp: vi.fn(),
			reply: vi.fn(),
		}

		await manager.cancelBet(interaction as never, 'user-1', 42)

		expect(cancel).toHaveBeenCalledWith({
			userId: 'user-1',
			betId: 42,
			guildId: 'guild-1',
			patreonDataDto: { patreonOverride: false },
		})
	})

	it('serializes the guild scope into the Khronos cancellation body', async () => {
		const wrapper = new BetslipWrapper()
		type RequestTransform = (context: {
			init: { body: string }
		}) => Promise<{ body: string }>
		const cancelBetslip = vi.fn(
			async (_request: unknown, transform: RequestTransform) =>
				transform({
					init: { body: JSON.stringify({ patreonOverride: false }) },
				}),
		)
		;(wrapper as never as { betslipApi: unknown }).betslipApi = {
			cancelBetslip,
		}

		const serialized = (await wrapper.cancel({
			userId: 'user-1',
			betId: 42,
			guildId: 'guild-1',
			patreonDataDto: { patreonOverride: false },
		})) as unknown as { body: string }
		expect(JSON.parse(serialized.body)).toEqual({
			patreonOverride: false,
			guild_id: 'guild-1',
		})

		expect(cancelBetslip).toHaveBeenCalledWith(
			{
				userId: 'user-1',
				betId: 42,
				patreonDataDto: {
					patreonOverride: false,
					guild_id: 'guild-1',
				},
			},
			expect.any(Function),
		)
	})

	it('clears pending state when the cancellation cache has expired', async () => {
		const handler = new ButtonHandler({} as never, {} as never)
		;(handler as never as { betsCacheService: unknown }).betsCacheService =
			{
				getUserBet: vi.fn().mockResolvedValue(undefined),
			}
		const clearPending = vi
			.spyOn(BetslipWrapper.prototype, 'clearPending')
			.mockResolvedValue({} as never)
		const interaction = {
			customId: 'matchup_btn_cancel',
			guildId: 'guild-1',
			user: {
				id: 'user-1',
				displayAvatarURL: () => 'avatar',
			},
			deferUpdate: vi.fn(),
			editReply: vi.fn(),
		}

		await handler.parse(interaction as never)

		expect(clearPending).toHaveBeenCalledWith('user-1')
		expect(interaction.editReply).toHaveBeenCalledWith(
			expect.objectContaining({ components: [] }),
		)
	})

	it('documents the current client serializer dropping guild scope', () => {
		// Client 3.8.0 serializes only patreonOverride; flip this assertion when bumped.
		expect(
			PatreonDataDtoToJSON({
				patreonOverride: false,
				guild_id: 'guild-1',
			} as never),
		).toEqual({ patreonOverride: false })
	})
})
