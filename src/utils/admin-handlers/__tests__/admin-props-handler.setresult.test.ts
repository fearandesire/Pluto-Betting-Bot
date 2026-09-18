import { SlashCommandBuilder } from 'discord.js'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../admin-predictions-handler.js', () => ({
	AdminPredictionsHandler: class {},
}))

vi.mock('../admin-props-handler.js', () => ({
	AdminPropsHandler: class {},
}))

const { UserCommand } = await import('../../../commands/admin/admin.js')

describe('/admin props command tree', () => {
	it('registers only the supported props subcommands', () => {
		const command = Object.create(UserCommand.prototype) as InstanceType<
			typeof UserCommand
		>
		const registry = {
			registerChatInputCommand: vi.fn(),
		}

		Object.defineProperties(command, {
			name: { configurable: true, value: 'admin' },
			description: {
				configurable: true,
				value: 'Admin commands for managing predictions and props',
			},
		})

		command.registerApplicationCommands(registry as never)

		const [builder] = registry.registerChatInputCommand.mock.calls[0]
		const json = builder(new SlashCommandBuilder()).toJSON()
		const propsGroup = json.options?.find(
			(option) => option.name === 'props',
		)

		expect(propsGroup?.options?.map((option) => option.name)).toEqual([
			'generate',
			'viewactive',
		])
	})
})
