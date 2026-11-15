import {
	context,
	type Span,
	SpanKind,
	SpanStatusCode,
	trace,
} from '@opentelemetry/api'
import { Events as SapphireEvents } from '@sapphire/framework'
import { type Client, Events, type Interaction } from 'discord.js'
import { runWithRequestId } from './request-context.js'
import { redactDiscordIds } from './span-redaction.js'

type Emit = (event: string | symbol, ...args: unknown[]) => boolean

/** The one piece of work Sapphire awaits for buttons, selects and modals. */
export interface InteractionHandlerRunner {
	run(interaction: Interaction): Promise<unknown>
}

/**
 * Every listener for an event runs synchronously inside `emit`, so one
 * wrapper here scopes all command, button, modal and select handling to the
 * interaction's request id.
 */
export function bindInteractionRequestContext(client: Client): void {
	wrapInteractionEmit(client, (interaction, dispatch) =>
		runWithRequestId(interaction.id, dispatch),
	)
}

const tracer = trace.getTracer('pluto.discord')

const spanName = (interaction: Interaction): string =>
	interaction.isCommand()
		? `discord.interaction /${interaction.commandName}`
		: `discord.interaction ${interaction.isModalSubmit() ? 'modal' : 'component'}`

const spanAttributes = (interaction: Interaction) => ({
	'discord.interaction.type': interaction.type,
	'discord.user.id': interaction.user.id,
	...(interaction.isCommand()
		? { 'discord.command.name': interaction.commandName }
		: {}),
	...(interaction.isMessageComponent() || interaction.isModalSubmit()
		? { 'discord.custom_id': redactDiscordIds(interaction.customId) }
		: {}),
})

/**
 * Sapphire's events that close a command interaction, and where each one
 * carries the interaction. A command error is always followed by Finish.
 */
const COMMAND_SPAN_END: ReadonlyArray<{
	event: string
	interaction: (args: unknown[]) => Interaction
	failed: boolean
}> = [
	{
		event: SapphireEvents.ChatInputCommandFinish,
		interaction: (args) => args[0] as Interaction,
		failed: false,
	},
	{
		event: SapphireEvents.ContextMenuCommandFinish,
		interaction: (args) => args[0] as Interaction,
		failed: false,
	},
	{
		event: SapphireEvents.ChatInputCommandDenied,
		interaction: (args) =>
			(args[1] as { interaction: Interaction }).interaction,
		failed: false,
	},
	{
		event: SapphireEvents.ContextMenuCommandDenied,
		interaction: (args) =>
			(args[1] as { interaction: Interaction }).interaction,
		failed: false,
	},
	{
		event: SapphireEvents.UnknownChatInputCommand,
		interaction: (args) =>
			(args[0] as { interaction: Interaction }).interaction,
		failed: true,
	},
	{
		event: SapphireEvents.UnknownContextMenuCommand,
		interaction: (args) =>
			(args[0] as { interaction: Interaction }).interaction,
		failed: true,
	},
]

const ERROR_EVENTS = [
	SapphireEvents.ChatInputCommandError,
	SapphireEvents.ContextMenuCommandError,
	SapphireEvents.InteractionHandlerError,
]

/**
 * Adds a `discord.interaction` span around each command, button, select and
 * modal, on top of the request context. Autocomplete is not traced: it fires
 * per keystroke. The user id lives only in `discord.user.id` (D11).
 */
export function traceInteractions(
	client: Client,
	handlers: InteractionHandlerRunner,
): void {
	const open = new WeakMap<Interaction, Span>()
	const end = (interaction: Interaction, failed: boolean) => {
		const span = open.get(interaction)
		if (!span) return
		open.delete(interaction)
		if (failed) span.setStatus({ code: SpanStatusCode.ERROR })
		span.end()
	}

	wrapInteractionEmit(client, (interaction, dispatch) =>
		runWithRequestId(interaction.id, () => {
			if (interaction.isAutocomplete()) return dispatch()
			const span = tracer.startSpan(spanName(interaction), {
				kind: SpanKind.SERVER,
				attributes: spanAttributes(interaction),
			})
			open.set(interaction, span)
			return context.with(trace.setSpan(context.active(), span), dispatch)
		}),
	)

	for (const { event, interaction, failed } of COMMAND_SPAN_END) {
		client.on(event, (...args: unknown[]) => end(interaction(args), failed))
	}
	for (const event of ERROR_EVENTS) {
		client.on(event as string, (...args: unknown[]) => {
			const [error, payload] = args as [
				unknown,
				{ interaction: Interaction },
			]
			const span = open.get(payload.interaction)
			if (error instanceof Error) span?.recordException(error)
			span?.setStatus({ code: SpanStatusCode.ERROR })
		})
	}

	const run = handlers.run.bind(handlers)
	handlers.run = async (interaction) => {
		try {
			return await run(interaction)
		} finally {
			end(interaction, false)
		}
	}
}

function wrapInteractionEmit(
	client: Client,
	around: (interaction: Interaction, dispatch: () => boolean) => boolean,
): void {
	const emit = client.emit.bind(client) as Emit
	client.emit = ((event: string | symbol, ...args: unknown[]) => {
		if (event !== Events.InteractionCreate) return emit(event, ...args)
		return around(args[0] as Interaction, () => emit(event, ...args))
	}) as Client['emit']
}
