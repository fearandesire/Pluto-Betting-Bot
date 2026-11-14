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
		transitionIfValue: vi.fn(async () => false),
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
			'matchup_btn_confirm',
		)
		// The next confirm re-sends the new price and the same placement.
		const next = await service.sanitize((await service.getUserBet('u1'))!)
		expect(next.expected_odds).toBe(-120)
		expect(next.placement_id).toBe('p-1')
	})
})

describe('expected_odds on doubledown', () => {
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

describe('doubledown re-prompt button', () => {
	it('carries the new price back to the confirm', async () => {
		const { doubleDownReprompt, parseDoubleDownConfirmId } = await import(
			'../../../../../lib/discord/builders/betting.js'
		)
		const { embeds, components } = doubleDownReprompt({
			betId: 7,
			notice: 'moved',
			amount: '$200.00',
			payout: '$383.33',
			profit: '$183.33',
			currentOdds: -120,
			avatarUrl: 'https://a/x.png',
		})
		expect(embeds[0].toJSON().description).toContain('$383.33')
		const id = components[0].toJSON().components[0] as { custom_id: string }
		expect(parseDoubleDownConfirmId(id.custom_id)).toEqual({
			betId: 7,
			expectedOdds: -120,
		})
		expect(parseDoubleDownConfirmId('doubledown_cancel')).toBeNull()
	})
})
