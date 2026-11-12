import { type Client, Events, type Interaction } from 'discord.js'
import { runWithRequestId } from './request-context.js'

/**
 * Every listener for an event runs synchronously inside `emit`, so one
 * wrapper here scopes all command, button, modal and select handling to the
 * interaction's request id.
 */
export function bindInteractionRequestContext(client: Client): void {
	const emit = client.emit.bind(client) as (
		event: string | symbol,
		...args: unknown[]
	) => boolean
	client.emit = ((event: string | symbol, ...args: unknown[]) => {
		if (event !== Events.InteractionCreate) return emit(event, ...args)
		const interaction = args[0] as Interaction
		return runWithRequestId(interaction.id, () => emit(event, ...args))
	}) as Client['emit']
}
