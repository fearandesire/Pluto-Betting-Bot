import { Client, Events } from 'discord.js'
import { describe, expect, it } from 'vitest'
import { bindInteractionRequestContext } from '../interaction-context.js'
import { currentRequestId } from '../request-context.js'

const tick = () => new Promise((resolve) => setTimeout(resolve, 1))

describe('bindInteractionRequestContext', () => {
	it('gives every interaction listener the interaction id, across awaits', async () => {
		const client = new Client({ intents: [] })
		bindInteractionRequestContext(client)
		const seen: Array<string | undefined> = []
		const done = new Promise<void>((resolve) => {
			client.on(Events.InteractionCreate, async () => {
				await tick()
				seen.push(currentRequestId())
				resolve()
			})
		})

		client.emit(Events.InteractionCreate, {
			id: '1234567890123456789',
		} as never)
		await done

		expect(seen).toEqual(['1234567890123456789'])
		expect(currentRequestId()).toBeUndefined()
		await client.destroy()
	})

	it('leaves other events without a request id', () => {
		const client = new Client({ intents: [] })
		bindInteractionRequestContext(client)
		let seen: string | undefined = 'unset'
		client.on(Events.Warn, () => {
			seen = currentRequestId()
		})

		expect(client.emit(Events.Warn, 'w')).toBe(true)
		expect(seen).toBeUndefined()
	})
})
