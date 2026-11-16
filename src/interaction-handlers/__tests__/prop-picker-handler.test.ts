import { MessageFlags } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toJsonComponents } from '../../lib/discord/v2/__tests__/v2-assert.js'

const state = vi.hoisted(() => ({
	load: vi.fn(),
	save: vi.fn(),
	clear: vi.fn(),
	recheck: vi.fn(),
	post: vi.fn(),
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
	InteractionHandlerTypes: { MessageComponent: 'message-component' },
}))

vi.mock('../../utils/props/PropPickerStore.js', () => ({
	loadPropPickerSession: state.load,
	savePropPickerSession: state.save,
	clearPropPickerSession: state.clear,
}))

vi.mock('../../utils/props/PropPickerService.js', () => ({
	PropPickerService: class {
		constructor() {
			return { recheck: state.recheck, post: state.post }
		}
	},
}))

vi.mock('../../utils/api/Khronos/props/props-api-wrapper.js', () => ({
	default: class {},
}))

vi.mock('../../utils/logging/WinstonLogger.js', () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

const { PropPickerHandler } = await import('../prop-picker-handler.js')
const { encodePropPickerId } = await import(
	'../../lib/discord/builders/prop-picker.js'
)
const { buildPropPickerPairs, initialPropPickerPrices } = await import(
	'../../utils/props/PropPicker.js'
)

const TOKEN = '0123456789abcdef'
const OWNER = 'admin-1'

function session() {
	const pairs = buildPropPickerPairs(
		Array.from({ length: 30 }, (_, index) => ({
			event_id: `event-${index % 2}`,
			event_context: {
				home_team: 'Home',
				away_team: 'Away',
				commence_time: '2026-07-11T18:00:00Z',
				sport_title: 'NBA',
			},
			market_key: 'player_points',
			bookmaker_key: 'draftkings',
			outcomes: [
				{
					outcome_uuid: `over-${index}`,
					name: 'Over',
					description: `Player ${index + 1}`,
					price: -110,
					point: 10.5 + index,
				},
				{
					outcome_uuid: `under-${index}`,
					name: 'Under',
					description: `Player ${index + 1}`,
					price: 100,
					point: 10.5 + index,
				},
			],
		})),
	)
	return {
		token: TOKEN,
		userId: OWNER,
		guildId: 'guild-1',
		sport: 'nba' as const,
		filters: { game: '', category: '', player: '' },
		page: 0,
		selected: [] as string[],
		pairs,
		prices: initialPropPickerPrices(pairs),
	}
}

function interaction(
	action: 'select' | 'prev' | 'next' | 'clear' | 'preview' | 'post',
	overrides: Record<string, unknown> = {},
) {
	return {
		customId: encodePropPickerId(TOKEN, action),
		user: { id: OWNER },
		values: [] as string[],
		deferred: false,
		replied: false,
		isMessageComponent: () => true,
		isStringSelectMenu: () => action === 'select',
		deferUpdate: vi.fn(async () => undefined),
		editReply: vi.fn(async () => undefined),
		reply: vi.fn(async () => undefined),
		followUp: vi.fn(async () => undefined),
		...overrides,
	}
}

function firstText(payload: unknown): string | undefined {
	const [container] = toJsonComponents(payload as never) as Array<{
		components?: Array<{ content?: string }>
	}>
	return container.components?.[0]?.content
}

function makeHandler() {
	return new PropPickerHandler({} as never, {} as never)
}

describe('PropPickerHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		state.save.mockResolvedValue(true)
		state.load.mockResolvedValue(session())
		state.recheck.mockResolvedValue({
			changes: [],
			missing: [],
			prices: {},
		})
		state.post.mockResolvedValue({
			posted: 1,
			skipped: 0,
			failed: 0,
			refused: [],
			ledger_entries: [],
		})
	})

	it('explains an expired picker instead of failing', async () => {
		state.load.mockResolvedValue(null)
		const reply = interaction('preview')

		await makeHandler().run(reply as never, {
			action: 'preview',
			token: TOKEN,
		})

		expect(
			firstText((reply.reply.mock.calls as unknown[][])[0]?.[0]),
		).toContain('expired')
	})

	it('only lets the opening admin use the controls', async () => {
		const reply = interaction('preview', { user: { id: 'someone-else' } })

		await makeHandler().run(reply as never, {
			action: 'preview',
			token: TOKEN,
		})

		expect(
			firstText((reply.reply.mock.calls as unknown[][])[0]?.[0]),
		).toContain('Only the admin')
	})

	it('keeps the current page picks and saves them', async () => {
		const current = session()
		state.load.mockResolvedValue(current)
		const select = interaction('select', { values: ['0', '2'] })

		await makeHandler().run(select as never, {
			action: 'select',
			token: TOKEN,
		})

		expect(current.selected).toEqual([
			current.pairs[0]!.key,
			current.pairs[2]!.key,
		])
		expect(state.save).toHaveBeenCalledWith(TOKEN, current)
		expect(select.editReply).toHaveBeenCalled()
	})

	it('moves to the next page without losing selections', async () => {
		const current = session()
		current.selected = [current.pairs[0]!.key]
		state.load.mockResolvedValue(current)
		const next = interaction('next')

		await makeHandler().run(next as never, {
			action: 'next',
			token: TOKEN,
		})

		expect(current.page).toBe(1)
		expect(current.selected).toEqual([current.pairs[0]!.key])
		expect(next.editReply).toHaveBeenCalled()
	})

	it('asks for a selection before posting', async () => {
		const post = interaction('post')

		await makeHandler().run(post as never, {
			action: 'post',
			token: TOKEN,
		})

		expect(
			firstText((post.reply.mock.calls as unknown[][])[0]?.[0]),
		).toContain('Select at least one')
		expect(state.post).not.toHaveBeenCalled()
	})

	it('shows moved prices and waits for a second Post click', async () => {
		const current = session()
		current.selected = [current.pairs[0]!.key]
		state.load.mockResolvedValue(current)
		state.recheck.mockResolvedValue({
			changes: [
				{
					key: current.pairs[0]!.key,
					label: 'Player 1 · player_points · 10.5',
					before: { over: -110, under: 100 },
					after: { over: -125, under: 105 },
				},
			],
			missing: [],
			prices: current.prices,
		})
		const post = interaction('post')

		await makeHandler().run(post as never, {
			action: 'post',
			token: TOKEN,
		})

		expect(state.post).not.toHaveBeenCalled()
		const calls = post.editReply.mock.calls as unknown[][]
		const payload = calls[calls.length - 1]?.[0]
		expect(JSON.stringify(payload)).toContain('Prices moved')
		expect(state.save).toHaveBeenCalled()
	})

	it('removes a vanished pair without claiming a price move', async () => {
		const current = session()
		current.selected = [current.pairs[0]!.key]
		state.load.mockResolvedValue(current)
		state.recheck.mockResolvedValue({
			changes: [
				{
					key: current.pairs[0]!.key,
					label: 'Player 1 · player_points · 10.5',
					before: { over: -110, under: 100 },
					after: { over: -110, under: 100 },
				},
			],
			missing: [current.pairs[0]],
			prices: current.prices,
		})
		const post = interaction('post')

		await makeHandler().run(post as never, {
			action: 'post',
			token: TOKEN,
		})

		const calls = post.editReply.mock.calls as unknown[][]
		const payload = JSON.stringify(calls[calls.length - 1]?.[0])
		expect(payload).toContain('no longer quoted')
		expect(payload).not.toContain('Prices moved')
		expect(current.selected).toHaveLength(0)
	})

	it('keeps the selection when the price check fails', async () => {
		const current = session()
		current.selected = [current.pairs[0]!.key]
		state.load.mockResolvedValue(current)
		state.recheck.mockRejectedValue(new Error('network down'))
		const post = interaction('post')

		await makeHandler().run(post as never, {
			action: 'post',
			token: TOKEN,
		})

		const calls = post.editReply.mock.calls as unknown[][]
		expect(JSON.stringify(calls[calls.length - 1]?.[0])).toContain(
			"Couldn't check prices",
		)
		expect(state.post).not.toHaveBeenCalled()
		expect(current.selected).toEqual([current.pairs[0]!.key])
	})

	it('keeps the picker usable when the price check fails', async () => {
		const current = session()
		current.selected = [current.pairs[0]!.key]
		state.load.mockResolvedValue(current)
		state.recheck.mockRejectedValue(new Error('network down'))
		const post = interaction('post')

		await makeHandler().run(post as never, { action: 'post', token: TOKEN })

		const calls = post.editReply.mock.calls as unknown[][]
		const json = JSON.stringify(calls[calls.length - 1]?.[0])
		expect(json).toContain(`props.pick.v1.post.${TOKEN}`)
	})

	it('keeps the picker usable when posting fails', async () => {
		const current = session()
		current.selected = [current.pairs[0]!.key]
		state.load.mockResolvedValue(current)
		state.post.mockRejectedValue(new Error('boom'))
		const post = interaction('post')

		await makeHandler().run(post as never, { action: 'post', token: TOKEN })

		const calls = post.editReply.mock.calls as unknown[][]
		const json = JSON.stringify(calls[calls.length - 1]?.[0])
		expect(json).toContain("Couldn't post the props")
		expect(json).toContain(`props.pick.v1.post.${TOKEN}`)
		expect(state.clear).not.toHaveBeenCalled()
	})

	it('reports an ephemeral error when a pick cannot be saved', async () => {
		state.save.mockResolvedValue(false)
		const select = interaction('select', { values: ['0'] })

		await makeHandler().run(select as never, {
			action: 'select',
			token: TOKEN,
		})

		expect(select.editReply).not.toHaveBeenCalled()
		expect(
			firstText((select.followUp.mock.calls as unknown[][])[0]?.[0]),
		).toContain("Couldn't save")
	})

	it('posts when the prices still match and clears the session', async () => {
		const current = session()
		current.selected = [current.pairs[0]!.key]
		state.load.mockResolvedValue(current)
		const post = interaction('post')

		await makeHandler().run(post as never, {
			action: 'post',
			token: TOKEN,
		})

		expect(state.post).toHaveBeenCalledWith(current)
		expect(state.clear).toHaveBeenCalledWith(TOKEN)
		const calls = post.editReply.mock.calls as unknown[][]
		const payload = calls[calls.length - 1]?.[0] as {
			flags: number
		}
		expect(payload.flags).toBe(MessageFlags.IsComponentsV2)
	})
})
