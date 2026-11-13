import { context, trace } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'
import {
	BasicTracerProvider,
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { Events as SapphireEvents } from '@sapphire/framework'
import { Client, Events, type Interaction } from 'discord.js'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { traceInteractions } from '../interaction-context.js'
import { currentRequestId } from '../request-context.js'
import { RedactingSpanProcessor } from '../span-redaction.js'

const exporter = new InMemorySpanExporter()
const contextManager = new AsyncLocalStorageContextManager().enable()
context.setGlobalContextManager(contextManager)
trace.setGlobalTracerProvider(
	new BasicTracerProvider({
		spanProcessors: [
			new RedactingSpanProcessor(new SimpleSpanProcessor(exporter)),
		],
	}),
)

afterAll(() => {
	trace.disable()
	context.disable()
})
beforeEach(() => exporter.reset())

const USER = '368578308872601602'
const tick = () => new Promise((resolve) => setTimeout(resolve, 1))

const fakeInteraction = (kind: 'command' | 'button') =>
	({
		id: '1300000000000000001',
		type: kind === 'command' ? 2 : 3,
		user: { id: USER },
		commandName: 'bet',
		customId: `confirm_bet_${USER}`,
		isCommand: () => kind === 'command',
		isAutocomplete: () => false,
		isModalSubmit: () => false,
		isMessageComponent: () => kind === 'button',
	}) as unknown as Interaction

const setup = () => {
	const client = new Client({ intents: [] })
	const seen: Array<{ traceId?: string; requestId?: string }> = []
	const handlers = {
		run: async (_interaction: Interaction) => {
			await tick()
			seen.push({
				traceId: trace.getActiveSpan()?.spanContext().traceId,
				requestId: currentRequestId(),
			})
		},
	}
	traceInteractions(client, handlers)
	return { client, handlers, seen }
}

describe('traceInteractions', () => {
	it('spans a command from dispatch to Finish, with the user id in one attribute', async () => {
		const { client } = setup()
		const interaction = fakeInteraction('command')
		let childTraceId: string | undefined
		client.on(Events.InteractionCreate, async () => {
			await tick()
			childTraceId = trace.getActiveSpan()?.spanContext().traceId
			client.emit(
				SapphireEvents.ChatInputCommandFinish as never,
				interaction,
			)
		})

		client.emit(Events.InteractionCreate, interaction)
		expect(exporter.getFinishedSpans()).toHaveLength(0)
		await tick()
		await tick()

		const [span] = exporter.getFinishedSpans()
		expect(span?.name).toBe('discord.interaction /bet')
		expect(span?.attributes).toMatchObject({
			'discord.user.id': USER,
			'discord.command.name': 'bet',
		})
		expect(childTraceId).toBe(span?.spanContext().traceId)
	})

	it('spans a button until the handler store settles, redacting ids in custom_id', async () => {
		const { client, handlers, seen } = setup()
		const interaction = fakeInteraction('button')
		let settled: Promise<unknown> | undefined
		client.on(Events.InteractionCreate, (i: Interaction) => {
			settled = handlers.run(i)
		})

		client.emit(Events.InteractionCreate, interaction)
		await settled

		const [span] = exporter.getFinishedSpans()
		expect(span?.name).toBe('discord.interaction component')
		expect(span?.attributes['discord.custom_id']).toBe('confirm_bet_:id')
		expect(seen).toEqual([
			{
				traceId: span?.spanContext().traceId,
				requestId: '1300000000000000001',
			},
		])
	})
})
