import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/footers/FooterManager.js', () => ({
	FooterManager: { getInstance: vi.fn() },
}))

// The real Sapphire base class needs a command store. The decorator under test
// merges its options into whatever base the command extends, so a plain class
// records the declared name and description.
vi.mock('@sapphire/plugin-subcommands', () => ({
	Subcommand: class {
		public name = ''
		public description = ''

		constructor(
			_context: unknown,
			options: { name?: string; description?: string } = {},
		) {
			this.name = options.name ?? ''
			this.description = options.description ?? ''
		}
	},
}))

const { SlashCommandBuilder } = await import('discord.js')
const { ConfigCommand } = await import('../config.js')

describe('owner footer config command', () => {
	it('registers as /footer-config so server settings keep /config', () => {
		const command = new ConfigCommand({} as never, {} as never)
		const registry = { registerChatInputCommand: vi.fn() }

		command.registerApplicationCommands(registry as never)

		expect(command.name).toBe('footer-config')
		const [configure] = registry.registerChatInputCommand.mock.calls[0]
		const json = configure(new SlashCommandBuilder()).toJSON()
		expect(json.name).toBe('footer-config')
		expect(json.options?.[0]?.name).toBe('footer')
	})
})
