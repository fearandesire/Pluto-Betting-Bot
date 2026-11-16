import { MessageFlags } from 'discord.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	expectV2Payload,
	toJsonComponents,
} from '../../lib/discord/v2/__tests__/v2-assert.js'

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

vi.mock('../../utils/logging/WinstonLogger.js', () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

const loadPropBrowse = vi.fn()

vi.mock('../../utils/props/PropBrowseCache.js', () => ({
	loadPropBrowse,
	PROP_BROWSE_TTL_SECONDS: 7 * 24 * 60 * 60,
}))

const { getPageSource, PageSourceExpiredError } = await import(
	'../../lib/discord/v2/paginator.js'
)
const { PropBrowseHandler } = await import('../prop-browse-handler.js')

const TOKEN = '0123456789abcdef'
const state = {
	title: 'All props',
	lines: Array.from({ length: 20 }, (_, i) => `row ${i}`),
}

function makeInteraction(customId: string) {
	return {
		customId,
		user: { id: 'user-1' },
		deferReply: vi.fn(),
		editReply: vi.fn(),
		followUp: vi.fn(),
	}
}

function firstText(payload: unknown): string | undefined {
	const [container] = toJsonComponents(payload as never) as Array<{
		components?: Array<{ content?: string }>
	}>
	return container.components?.[0]?.content
}

describe('PropBrowseHandler', () => {
	const handler = new PropBrowseHandler({} as never, {} as never)

	beforeEach(() => {
		vi.clearAllMocks()
		loadPropBrowse.mockResolvedValue(state)
	})

	it('parses only a valid props.browse.v1 token', () => {
		expect(
			handler.parse(makeInteraction(`props.browse.v1.${TOKEN}`) as never),
		).toEqual({
			kind: 'some',
			value: TOKEN,
		})
		expect(
			handler.parse(
				makeInteraction('props.browse.v2.0123456789abcdef') as never,
			),
		).toEqual({ kind: 'none' })
		expect(
			handler.parse(makeInteraction('props.browse.v1.short') as never),
		).toEqual({ kind: 'none' })
		expect(handler.parse(makeInteraction('prop_over-1') as never)).toEqual({
			kind: 'none',
		})
	})

	it('opens the list privately on page one', async () => {
		const interaction = makeInteraction(`props.browse.v1.${TOKEN}`)

		await handler.run(interaction as never, TOKEN)

		expect(interaction.deferReply).toHaveBeenCalledWith({
			flags: MessageFlags.Ephemeral,
		})
		const payload = interaction.editReply.mock.calls[0][0]
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 9,
		})
		expect(firstText(payload)).toBe('## All props')
		const text = JSON.stringify(payload)
		expect(text).toContain('row 0')
		expect(text).toContain('row 7')
		expect(text).not.toContain('row 8')
		expect(text).toContain('Page 1/3')
	})

	it('registers the page source so the nav buttons can page the list', async () => {
		const interaction = makeInteraction(`props.browse.v1.${TOKEN}`)
		await handler.run(interaction as never, TOKEN)

		const source = getPageSource(TOKEN)
		expect(source).toBeDefined()
		const page = await source!.load({} as never, 2)
		expect(page.lines).toEqual(state.lines)
		expect(page.perPage).toBe(8)
		expect(page.page).toBe(2)
	})

	it('reads the list from the cache on every page instead of holding it', async () => {
		const interaction = makeInteraction(`props.browse.v1.${TOKEN}`)
		await handler.run(interaction as never, TOKEN)
		loadPropBrowse.mockClear()

		const source = getPageSource(TOKEN)!
		await source.load({} as never, 1)
		await source.load({} as never, 2)

		expect(loadPropBrowse).toHaveBeenCalledTimes(2)
		expect(loadPropBrowse).toHaveBeenCalledWith(TOKEN)
	})

	it('reports an expired list when the cache entry is gone mid-browse', async () => {
		const interaction = makeInteraction(`props.browse.v1.${TOKEN}`)
		await handler.run(interaction as never, TOKEN)

		loadPropBrowse.mockResolvedValueOnce(null)
		await expect(
			getPageSource(TOKEN)!.load({} as never, 1),
		).rejects.toBeInstanceOf(PageSourceExpiredError)
	})

	it('releases the registered source after the list lifetime', async () => {
		vi.useFakeTimers()
		try {
			const token = 'aaaaaaaaaaaaaaaa'
			await handler.run(
				makeInteraction(`props.browse.v1.${token}`) as never,
				token,
			)
			expect(getPageSource(token)).toBeDefined()

			vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1)
			expect(getPageSource(token)).toBeUndefined()
		} finally {
			vi.useRealTimers()
		}
	})

	it('answers an expired list instead of failing silently', async () => {
		const expired = 'fedcba9876543210'
		loadPropBrowse.mockResolvedValueOnce(null)
		const interaction = makeInteraction(`props.browse.v1.${expired}`)

		await handler.run(interaction as never, expired)

		const payload = interaction.editReply.mock.calls[0][0]
		expect(firstText(payload)).toBe(
			'This props list expired. Run the props command again.',
		)
		expect(getPageSource(expired)).toBeUndefined()
	})
})
