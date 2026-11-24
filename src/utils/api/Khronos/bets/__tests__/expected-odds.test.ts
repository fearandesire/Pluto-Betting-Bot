import { ResponseError } from '@pluto-khronos/api-client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../lib/startup/env.js', () => ({ default: {} }))
vi.mock('../../../../cache/redis-instance.js', () => ({ default: {} }))
vi.mock('../../../../bot_res/findEmoji.js', () => ({
	findEmoji: async () => '',
}))
vi.mock('../../../../guilds/GuildUtils.js', () => ({ default: vi.fn() }))
vi.mock('../../guild/guild-wrapper.js', () => ({ default: vi.fn() }))
vi.mock('../../../patreon/Patreon-Facade.js', () => ({ default: {} }))
vi.mock('../../../common/handleNewUser.js', () => ({ handleNewUser: vi.fn() }))
vi.mock('../../../../logging/WinstonLogger.js', () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

import { BetsCacheService } from '../../../common/bets/BetsCacheService.js'
import { BetslipManager } from '../BetslipsManager.js'
import { parseOddsChanged } from '../odds-changed.js'

function memoryCache() {
	const store = new Map<string, unknown>()
	return {
		store,
		get: vi.fn(async (k: string) => store.get(k) ?? null),
		set: vi.fn(async (k: string, v: unknown) => {
			store.set(k, v)
		}),
		remove: vi.fn(async (k: string) => {
			store.delete(k)
		}),
		transitionIfValue: vi.fn(
			async (k: string, expected: unknown, next: unknown) => {
				if (JSON.stringify(store.get(k)) !== JSON.stringify(expected)) {
					return false
				}
				store.set(k, next)
				return true
			},
		),
	}
}

const initBetslip = {
	userid: 'u1',
	team: 'Boston Celtics',
	amount: 100,
	opponent: 'Los Angeles Lakers',
	dateofmatchup: '2026-11-15T00:30:00Z',
	profit: 66.67,
	payout: 166.67,
	selected_odds: -150,
	match: { id: 'evt-1' },
	guild_id: 'g1',
	placement_id: 'p-1',
}

function oddsChangedError(operation: 'place' | 'doubledown') {
	const body = {
		statusCode: 409,
		message: 'Odds changed',
		exception: 'OddsChangedException',
		exception_category: 'odds',
		details: {
			code: 'ODDS_CHANGED',
			operation,
			team: 'Boston Celtics',
			expected_odds: -150,
			current_odds: -120,
			amount: 100,
			profit: 83.33,
			payout: 183.33,
			added: { amount: 100, profit: 83.33, payout: 183.33 },
		},
	}
	return new ResponseError(
		new Response(JSON.stringify(body), {
			status: 409,
			headers: { 'content-type': 'application/json' },
		}),
	)
}

describe('expected_odds on place', () => {
	let cache: ReturnType<typeof memoryCache>
	let service: BetsCacheService

	beforeEach(() => {
		cache = memoryCache()
		service = new BetsCacheService(cache as never)
	})

	it('sends the odds quoted at init as expected_odds', async () => {
		await service.cacheUserBet('u1', initBetslip as never)
		const cached = await service.getUserBet('u1')
		const dto = await service.sanitize(cached!)
		expect(dto.expected_odds).toBe(-150)
	})

	it('re-prompts with the new price and payout on 409 ODDS_CHANGED', async () => {
		await service.cacheUserBet('u1', initBetslip as never)
		const wrapper = {
			finalize: vi.fn().mockRejectedValue(oddsChangedError('place')),
		}
		const interaction = {
			deferred: true,
			replied: false,
			user: { id: 'u1', displayAvatarURL: () => 'https://a/x.png' },
			editReply: vi.fn(async () => ({})),
			followUp: vi.fn(),
		}
		const cached = await service.getUserBet('u1')
		await new BetslipManager(wrapper as never, service).placeBet(
			interaction as never,
			await service.sanitize(cached!),
			{
				opponent: initBetslip.opponent,
				dateofmatchup: initBetslip.dateofmatchup,
			},
		)

		const reply = (interaction.editReply.mock.calls[0] as unknown[])[0] as {
			embeds: { toJSON(): { description: string } }[]
			components: { toJSON(): { components: { custom_id: string }[] } }[]
		}
		const text = reply.embeds[0].toJSON().description
		expect(text).toContain('-150')
		expect(text).toContain('-120')
		expect(text).toContain('$183.33')
		expect(text).toContain('$83.33')
		expect(reply.components[0].toJSON().components[0].custom_id).toBe(
			'matchup_btn_confirm.-120',
		)
		// The next confirm re-sends the new price and the same placement.
		const next = await service.sanitize((await service.getUserBet('u1'))!)
		expect(next.expected_odds).toBe(-120)
		expect(next.placement_id).toBe('p-1')
	})

	it('does not write a stale 409 into a newer slip', async () => {
		await service.cacheUserBet('u1', initBetslip as never)
		const stale = await service.sanitize((await service.getUserBet('u1'))!)
		await service.cacheUserBet('u1', {
			...initBetslip,
			placement_id: 'p-2',
		} as never)
		const wrapper = {
			finalize: vi.fn().mockRejectedValue(oddsChangedError('place')),
		}
		const interaction = {
			deferred: true,
			replied: false,
			user: { id: 'u1', displayAvatarURL: () => 'https://a/x.png' },
			editReply: vi.fn(async () => ({})),
			followUp: vi.fn(),
		}
		await new BetslipManager(wrapper as never, service).placeBet(
			interaction as never,
			stale,
			{
				opponent: initBetslip.opponent,
				dateofmatchup: initBetslip.dateofmatchup,
			},
		)
		const reply = (interaction.editReply.mock.calls[0] as unknown[])[0] as {
			components: unknown[]
		}
		expect(reply.components).toEqual([])
		const current = await service.getUserBet('u1')
		expect(current?.selected_odds).toBe(-150)
		expect(current?.placement_id).toBe('p-2')
	})
})

describe('place re-prompt races', () => {
	function placeInteraction() {
		return {
			deferred: true,
			replied: false,
			id: 'i1',
			user: { id: 'u1', displayAvatarURL: () => 'https://a/x.png' },
			editReply: vi.fn(async () => ({})),
			deleteReply: vi.fn(async () => undefined),
			followUp: vi.fn(async () => ({})),
		}
	}

	it('shows the new price before a confirm can send it', async () => {
		const cache = memoryCache()
		const service = new BetsCacheService(cache as never)
		await service.cacheUserBet('u1', initBetslip as never)
		const interaction = placeInteraction()
		let priceWhenShown: number | undefined
		interaction.editReply.mockImplementationOnce(async () => {
			priceWhenShown = (await service.getUserBet('u1'))?.selected_odds
			return {}
		})
		const wrapper = {
			finalize: vi.fn().mockRejectedValue(oddsChangedError('place')),
		}
		await new BetslipManager(wrapper as never, service).placeBet(
			interaction as never,
			await service.sanitize((await service.getUserBet('u1'))!),
			{
				opponent: initBetslip.opponent,
				dateofmatchup: initBetslip.dateofmatchup,
			},
		)
		expect(priceWhenShown).toBe(-150)
		expect((await service.getUserBet('u1'))?.selected_odds).toBe(-120)
	})

	it('does not reprice a slip replaced while the re-prompt renders', async () => {
		const cache = memoryCache()
		const service = new BetsCacheService(cache as never)
		await service.cacheUserBet('u1', initBetslip as never)
		const interaction = placeInteraction()
		interaction.editReply.mockImplementationOnce(async () => {
			await service.cacheUserBet('u1', {
				...initBetslip,
				placement_id: 'p-2',
			} as never)
			return {}
		})
		const wrapper = {
			finalize: vi.fn().mockRejectedValue(oddsChangedError('place')),
		}
		await new BetslipManager(wrapper as never, service).placeBet(
			interaction as never,
			await service.sanitize((await service.getUserBet('u1'))!),
			{
				opponent: initBetslip.opponent,
				dateofmatchup: initBetslip.dateofmatchup,
			},
		)
		const current = await service.getUserBet('u1')
		expect(current?.placement_id).toBe('p-2')
		expect(current?.selected_odds).toBe(-150)
		const calls = interaction.editReply.mock.calls as unknown[][]
		const last = calls[calls.length - 1]
		expect((last[0] as { components: unknown[] }).components).toEqual([])
	})

	it('answers the user when the cache fails during the re-prompt', async () => {
		const cache = memoryCache()
		const service = new BetsCacheService(cache as never)
		await service.cacheUserBet('u1', initBetslip as never)
		const dto = await service.sanitize((await service.getUserBet('u1'))!)
		cache.get.mockRejectedValue(new Error('redis down'))
		const interaction = placeInteraction()
		const wrapper = {
			finalize: vi.fn().mockRejectedValue(oddsChangedError('place')),
		}
		await new BetslipManager(wrapper as never, service).placeBet(
			interaction as never,
			dto,
			{
				opponent: initBetslip.opponent,
				dateofmatchup: initBetslip.dateofmatchup,
			},
		)
		expect(interaction.followUp).toHaveBeenCalledTimes(1)
		expect(JSON.stringify(interaction.followUp.mock.calls[0])).toContain(
			'Your bet was not placed',
		)
	})
})

describe('expected_odds on doubledown', () => {
	it('doubles down without expected_odds when the price lookup fails', async () => {
		const wrapper = {
			offeredPrice: vi.fn().mockRejectedValue(new Error('timeout')),
			doubleDown: vi.fn().mockResolvedValue({ status: 200, betslip: {} }),
		}
		await new BetslipManager(wrapper as never, {} as never).doubleDown(
			'u1',
			7,
		)
		expect(wrapper.doubleDown).toHaveBeenCalledWith({
			userId: 'u1',
			betId: 7,
		})
	})

	it('refuses a re-confirm when the bet changed since the prompt', async () => {
		const { StaleDoubleDownError } = await import('../odds-changed.js')
		const wrapper = {
			betAmount: vi.fn().mockResolvedValue(200),
			offeredPrice: vi.fn(),
			doubleDown: vi.fn(),
		}
		await expect(
			new BetslipManager(wrapper as never, {} as never).doubleDown(
				'u1',
				7,
				-120,
				10000,
			),
		).rejects.toBeInstanceOf(StaleDoubleDownError)
		expect(wrapper.doubleDown).not.toHaveBeenCalled()
	})

	it('re-confirms when the stake still matches the prompt', async () => {
		const wrapper = {
			betAmount: vi.fn().mockResolvedValue(100),
			offeredPrice: vi.fn(),
			doubleDown: vi.fn().mockResolvedValue({ status: 200, betslip: {} }),
		}
		await new BetslipManager(wrapper as never, {} as never).doubleDown(
			'u1',
			7,
			-120,
			10000,
		)
		expect(wrapper.doubleDown).toHaveBeenCalledWith({
			userId: 'u1',
			betId: 7,
			expectedOdds: -120,
		})
	})

	it('sends the price the bet was confirmed at', async () => {
		const wrapper = {
			offeredPrice: vi.fn().mockResolvedValue(120),
			doubleDown: vi.fn().mockResolvedValue({ status: 200, betslip: {} }),
		}
		await new BetslipManager(wrapper as never, {} as never).doubleDown(
			'u1',
			7,
		)
		expect(wrapper.doubleDown).toHaveBeenCalledWith({
			userId: 'u1',
			betId: 7,
			expectedOdds: 120,
		})
	})

	it('sends the re-confirmed price when given one', async () => {
		const wrapper = {
			offeredPrice: vi.fn(),
			doubleDown: vi.fn().mockResolvedValue({ status: 200, betslip: {} }),
		}
		await new BetslipManager(wrapper as never, {} as never).doubleDown(
			'u1',
			7,
			-120,
		)
		expect(wrapper.offeredPrice).not.toHaveBeenCalled()
		expect(wrapper.doubleDown).toHaveBeenCalledWith({
			userId: 'u1',
			betId: 7,
			expectedOdds: -120,
		})
	})
})

describe('parseOddsChanged', () => {
	it('reads the refusal and leaves the body readable', async () => {
		const err = oddsChangedError('doubledown')
		const details = await parseOddsChanged(err)
		expect(details?.current_odds).toBe(-120)
		expect((await err.response.json()).details.code).toBe('ODDS_CHANGED')
	})

	it('ignores other errors', async () => {
		expect(await parseOddsChanged(new Error('x'))).toBeNull()
		const other = new ResponseError(
			new Response(JSON.stringify({ details: { code: 'NOPE' } }), {
				status: 409,
			}),
		)
		expect(await parseOddsChanged(other)).toBeNull()
	})
})

describe('place confirm button', () => {
	it('binds a re-prompt confirm to the price it shows', async () => {
		const { parsePlaceConfirm, placeConfirmId } = await import(
			'../../../../../lib/discord/builders/betting.js'
		)
		expect(parsePlaceConfirm(placeConfirmId())).toEqual({})
		expect(parsePlaceConfirm(placeConfirmId(-120))).toEqual({
			quotedOdds: -120,
		})
		expect(parsePlaceConfirm(placeConfirmId(135))).toEqual({
			quotedOdds: 135,
		})
		expect(parsePlaceConfirm('matchup_btn_cancel')).toBeNull()
	})
})

describe('doubledown re-prompt button', () => {
	it('carries the new price back to the confirm', async () => {
		const { doubleDownReprompt, parseDoubleDownButton } = await import(
			'../../../../../lib/discord/builders/betting.js'
		)
		const { embeds, components } = doubleDownReprompt({
			betId: 7,
			notice: 'moved',
			amount: '$200.00',
			payout: '$383.33',
			profit: '$183.33',
			currentOdds: -120,
			stakeCents: 10000,
			avatarUrl: 'https://a/x.png',
		})
		expect(embeds[0].toJSON().description).toContain('$383.33')
		const id = components[0].toJSON().components[0] as { custom_id: string }
		expect(parseDoubleDownButton(id.custom_id)).toEqual({
			kind: 'confirm',
			betId: 7,
			expectedOdds: -120,
			stakeCents: 10000,
		})
		expect(parseDoubleDownButton('dd.v1.cancel')).toEqual({
			kind: 'cancel',
		})
		expect(parseDoubleDownButton('dd.v0.confirm.7.1')).toEqual({
			kind: 'stale',
		})
	})
})
