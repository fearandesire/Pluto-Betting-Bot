import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toJsonComponents } from '../../lib/discord/v2/__tests__/v2-assert.js'

vi.mock('@sapphire/framework', () => ({
	InteractionHandler: class {
		public none() {
			return { kind: 'none' }
		}
		public some(value: unknown) {
			return { kind: 'some', value }
		}
	},
	InteractionHandlerTypes: { MessageComponent: 'component' },
}))

vi.mock('../../utils/logging/WinstonLogger.js', () => ({
	logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}))

vi.mock('../../lib/startup/env.js', () => ({
	default: { PROFILE_VIEWS_ENABLED: true },
}))

const model = {
	userId: '111111111111111111',
	displayName: 'Carl',
	avatarUrl: null,
	balance: 100,
	level: 2,
	tier: 'Silver',
	stats: { wins: 1, losses: 1, pushes: 0, netProfit: 5 },
	achievements: {
		earned: Array.from({ length: 5 }, (_, i) => ({
			key: `e${i}`,
			label: `Earned ${i}`,
			criteria: 'Do it.',
			kind: 'career',
			state: 'earned',
			emoji: null,
			art: null,
			awardedAt: '2026-10-01T12:00:00.000Z',
			gates: [],
		})),
		locked: [],
		total: 5,
	},
}

vi.mock('../../utils/profile-card/profile-view-service.js', () => ({
	resolveProfileSubject: async () => ({}),
	loadProfileForViews: async () => ({ model, preference: undefined }),
	viewFor: () => 'headline',
}))

vi.mock('../../utils/api/requests/accounts/AccountManager.js', () => ({
	AccountsWrapper: class {},
}))

const { ProfileViewHandler } = await import('../profile-view-handler.js')
const { encodeProfileViewAction } = await import(
	'../../lib/discord/builders/profile-view-ids.js'
)

const OWNER = '111111111111111111'
let seq = 0

const click = (
	messageId: string,
	action: Parameters<typeof encodeProfileViewAction>[0],
) => ({
	customId: encodeProfileViewAction(action),
	user: { id: OWNER },
	message: { id: messageId },
	isMessageComponent: () => true,
	deferred: false,
	replied: false,
	reply: vi.fn(),
	deferUpdate: vi.fn(),
	followUp: vi.fn(),
	editReply: vi.fn(),
})

const shareButton = (interaction: ReturnType<typeof click>) => {
	const payload =
		interaction.editReply.mock.calls[
			interaction.editReply.mock.calls.length - 1
		]?.[0]
	const found: Array<{ label?: string; disabled?: boolean }> = []
	const walk = (n: unknown) => {
		if (!n || typeof n !== 'object') return
		const node = n as Record<string, unknown>
		if (node.type === 2) found.push(node as never)
		for (const v of Object.values(node))
			Array.isArray(v) ? v.forEach(walk) : walk(v)
	}
	toJsonComponents(payload).forEach(walk)
	return found.find(
		(b) => b.label === 'Shared' || b.label === 'Share to channel',
	)
}

describe('ProfileViewHandler share state', () => {
	let handler: InstanceType<typeof ProfileViewHandler>
	beforeEach(() => {
		handler = new (
			ProfileViewHandler as never as new (
				a: unknown,
				b: unknown,
			) => typeof handler
		)({}, {})
	})

	it('keeps Share spent after expanding and collapsing a shared card', async () => {
		seq += 1
		const id = `msg-${seq}`
		const route = { ownerId: OWNER, targetId: OWNER }
		const run = (i: ReturnType<typeof click>) =>
			handler.run(
				i as never,
				(handler.parse(i as never) as unknown as { value: never })
					.value,
			)

		const share = click(id, { kind: 'share', ...route })
		await run(share)
		expect(shareButton(share)?.disabled).toBe(true)

		const expand = click(id, { kind: 'expand', ...route, page: 0 })
		await run(expand)
		const collapse = click(id, { kind: 'collapse', ...route })
		await run(collapse)
		const button = shareButton(collapse)
		expect(button?.label).toBe('Shared')
		expect(button?.disabled).toBe(true)
	})

	it('leaves Share live on a card that was never shared', async () => {
		seq += 1
		const collapse = click(`msg-${seq}`, {
			kind: 'collapse',
			ownerId: OWNER,
			targetId: OWNER,
		})
		await handler.run(
			collapse as never,
			(handler.parse(collapse as never) as unknown as { value: never })
				.value,
		)
		expect(shareButton(collapse)?.disabled).toBe(false)
	})
})
