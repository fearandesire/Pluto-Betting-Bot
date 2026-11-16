import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockSetGuildConfig = vi.fn()
const mockGetGuild = vi.fn()
const mockGetSettings = vi.fn()
const mockSetStrategy = vi.fn()

// Mock only the Khronos HTTP edge; the wrapper's own setting mapping runs for real.
vi.mock('@pluto-khronos/api-client', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('@pluto-khronos/api-client')>()
	return {
		...actual,
		DiscordConfigApi: vi.fn().mockImplementation(function () {
			return { setGuildConfig: mockSetGuildConfig }
		}),
	}
})

vi.mock('../../../utils/api/Khronos/KhronosInstances.js', () => ({
	KH_API_CONFIG: {},
}))

vi.mock('../../../utils/api/Khronos/guild/guild-wrapper.js', () => ({
	default: vi.fn().mockImplementation(function () {
		return { getGuild: mockGetGuild }
	}),
}))

vi.mock(
	'../../../utils/api/Khronos/props/prop-settings-wrapper.js',
	async (importOriginal) => {
		const actual =
			await importOriginal<
				typeof import('../../../utils/api/Khronos/props/prop-settings-wrapper.js')
			>()
		return {
			...actual,
			default: vi.fn().mockImplementation(function () {
				return { get: mockGetSettings, setStrategy: mockSetStrategy }
			}),
		}
	},
)

const { PropSettingsError } = await import(
	'../../../utils/api/Khronos/props/prop-settings-wrapper.js'
)
const {
	MessageFlags,
	PermissionFlagsBits,
	PermissionsBitField,
	SlashCommandBuilder,
} = await import('discord.js')
const { UserCommand } = await import('../props.js')
const { expectV2Payload, toJsonComponents } = await import(
	'../../../lib/discord/v2/__tests__/v2-assert.js'
)

const GUILD_ID = '555171631539028000'
const CHANNEL_ID = '1100000000000000001'
const OTHER_CHANNEL_ID = '1100000000000000002'
const ALL_PERMISSIONS = [
	PermissionFlagsBits.ViewChannel,
	PermissionFlagsBits.SendMessages,
	PermissionFlagsBits.EmbedLinks,
	PermissionFlagsBits.ReadMessageHistory,
]

function makeInteraction(
	opts: { permissions?: bigint[]; channelId?: string } = {},
) {
	const me = { id: 'bot' }
	const channel = {
		id: opts.channelId ?? CHANNEL_ID,
		permissionsFor: vi.fn(
			() => new PermissionsBitField(opts.permissions ?? ALL_PERMISSIONS),
		),
	}
	return {
		guildId: GUILD_ID,
		guild: { members: { me, fetchMe: vi.fn() } },
		inCachedGuild: () => true,
		deferReply: vi.fn().mockResolvedValue(undefined),
		editReply: vi.fn().mockResolvedValue(undefined),
		options: { getChannel: vi.fn(() => channel) },
		channel,
		me,
	}
}

type Interaction = ReturnType<typeof makeInteraction>

type ConfigWrite = {
	createConfigDto: { setting_type: string; setting_value: string }
}

/** Every Khronos config write in order, as `setting_type:setting_value`. */
function writes(): string[] {
	return mockSetGuildConfig.mock.calls.map((call) => {
		const { setting_type, setting_value } = (call[0] as ConfigWrite)
			.createConfigDto
		return `${setting_type}:${setting_value}`
	})
}

function deferred() {
	let resolve!: () => void
	const promise = new Promise<void>((done) => {
		resolve = done
	})
	return { promise, resolve }
}

function flushMicrotasks() {
	return new Promise((resolve) => setTimeout(resolve, 0))
}

/** Text of every text display in the single reply, joined by newlines. */
function replyText(interaction: Interaction): string {
	const payload = interaction.editReply.mock.calls[0]![0]
	const [container] = toJsonComponents(payload) as Array<{
		components: Array<{ content?: string }>
	}>
	return container!.components
		.map((c) => c.content)
		.filter(Boolean)
		.join('\n')
}

function expectSingleV2Reply(interaction: Interaction) {
	expect(interaction.deferReply).toHaveBeenCalledWith({
		flags: MessageFlags.Ephemeral,
	})
	expect(interaction.editReply).toHaveBeenCalledTimes(1)
	const payload = interaction.editReply.mock.calls[0]![0]
	expect(payload.flags).toBe(MessageFlags.IsComponentsV2)
	expect('embeds' in payload).toBe(false)
	return payload
}

describe('/props', () => {
	let command: InstanceType<typeof UserCommand>

	beforeEach(() => {
		vi.clearAllMocks()
		mockSetGuildConfig.mockResolvedValue(undefined)
		mockGetSettings.mockResolvedValue(null)
		mockSetStrategy.mockResolvedValue({})
		command = Object.create(UserCommand.prototype) as InstanceType<
			typeof UserCommand
		>
		Object.defineProperty(command, 'container', {
			configurable: true,
			value: { logger: { error: vi.fn(), warn: vi.fn() } },
		})
	})

	it('registers an admin-only, guild-only command with a text channel picker', () => {
		const registry = { registerChatInputCommand: vi.fn() }
		Object.defineProperties(command, {
			name: { configurable: true, value: 'props' },
			description: {
				configurable: true,
				value: 'Turn daily player props on or off for this server',
			},
		})

		command.registerApplicationCommands(registry as never)

		const [builder, options] =
			registry.registerChatInputCommand.mock.calls[0]
		const json = builder(new SlashCommandBuilder()).toJSON()
		expect(json.name).toBe('props')
		expect(json.contexts).toEqual([0])
		expect(json.default_member_permissions).toBe(
			PermissionFlagsBits.Administrator.toString(),
		)
		expect(json.options?.map((o: { name: string }) => o.name)).toEqual([
			'enable',
			'disable',
			'status',
			'strategy',
		])
		const enable = json.options?.[0] as {
			options: Array<{
				name: string
				required: boolean
				channel_types: number[]
			}>
		}
		expect(enable.options[0]).toMatchObject({
			name: 'channel',
			required: true,
			channel_types: [0],
		})
		const strategy = json.options?.[3] as {
			options: Array<{
				name: string
				required: boolean
				choices: Array<{ name: string; value: string }>
			}>
		}
		expect(strategy.options[0]).toMatchObject({
			name: 'strategy',
			required: true,
			choices: [
				{ name: 'default', value: 'default' },
				{ name: 'smart', value: 'smart' },
			],
		})
		expect(options.idHints).toEqual([])
	})

	describe('enable', () => {
		it('keeps props disabled until the channel is saved, then enables and confirms', async () => {
			const interaction = makeInteraction()

			await command.handleEnable(interaction as never)

			expect(interaction.channel.permissionsFor).toHaveBeenCalledWith(
				interaction.me,
			)
			expect(mockSetGuildConfig.mock.calls).toEqual([
				[
					{
						createConfigDto: {
							guild_id: GUILD_ID,
							setting_type: 'PROPS_ENABLED',
							setting_value: 'false',
						},
					},
				],
				[
					{
						createConfigDto: {
							guild_id: GUILD_ID,
							setting_type: 'PREDICTIONS_CHAN',
							setting_value: CHANNEL_ID,
						},
					},
				],
				[
					{
						createConfigDto: {
							guild_id: GUILD_ID,
							setting_type: 'PROPS_ENABLED',
							setting_value: 'true',
						},
					},
				],
			])
			const payload = expectSingleV2Reply(interaction)
			// container + heading + body + divider + footer
			expectV2Payload(payload, {
				flags: MessageFlags.IsComponentsV2,
				components: 5,
			})
			expect(replyText(interaction)).toContain('Daily props enabled')
			expect(replyText(interaction)).toContain(`<#${CHANNEL_ID}>`)
		})

		it('writes nothing and names each missing permission', async () => {
			const interaction = makeInteraction({
				permissions: [PermissionFlagsBits.ViewChannel],
			})

			await command.handleEnable(interaction as never)

			expect(mockSetGuildConfig).not.toHaveBeenCalled()
			expectSingleV2Reply(interaction)
			const text = replyText(interaction)
			expect(text).toContain('Missing permissions')
			expect(text).toContain('- Send Messages')
			expect(text).toContain('- Embed Links')
			expect(text).toContain('- Read Message History')
			expect(text).not.toContain('- View Channel')
			expect(text).toContain('Nothing was changed')
		})

		it('writes nothing when the bot cannot see the channel at all', async () => {
			const interaction = makeInteraction({ permissions: [] })

			await command.handleEnable(interaction as never)

			expect(mockSetGuildConfig).not.toHaveBeenCalled()
			expect(replyText(interaction)).toContain('- View Channel')
		})

		it('reports a Khronos failure and never writes the channel', async () => {
			mockSetGuildConfig.mockRejectedValueOnce(new Error('503 upstream'))
			const interaction = makeInteraction()

			await command.handleEnable(interaction as never)

			expect(mockSetGuildConfig).toHaveBeenCalledTimes(1)
			expect(
				mockSetGuildConfig.mock.calls[0]![0].createConfigDto
					.setting_type,
			).toBe('PROPS_ENABLED')
			const text = replyText(interaction)
			expect(text).toContain('Something went wrong')
			expect(text).toContain('503 upstream')
			expect(text).not.toContain('enabled')
		})
		it('never re-enables an old channel when saving the new channel fails', async () => {
			mockSetGuildConfig.mockResolvedValueOnce(undefined)
			mockSetGuildConfig.mockRejectedValueOnce(
				new Error('channel save failed'),
			)
			const interaction = makeInteraction()

			await command.handleEnable(interaction as never)

			expect(mockSetGuildConfig).toHaveBeenCalledTimes(2)
			expect(
				mockSetGuildConfig.mock.calls[0]![0].createConfigDto,
			).toMatchObject({
				setting_type: 'PROPS_ENABLED',
				setting_value: 'false',
			})
			expect(
				mockSetGuildConfig.mock.calls[1]![0].createConfigDto,
			).toMatchObject({
				setting_type: 'PREDICTIONS_CHAN',
				setting_value: CHANNEL_ID,
			})
			expect(replyText(interaction)).toContain('Something went wrong')
			expect(replyText(interaction)).toContain('/props status')
			expect(replyText(interaction)).not.toContain('Daily props enabled')
		})
	})

	describe('disable', () => {
		it("writes PROPS_ENABLED='false' and leaves the channel alone", async () => {
			const interaction = makeInteraction()

			await command.handleDisable(interaction as never)

			expect(mockSetGuildConfig.mock.calls).toEqual([
				[
					{
						createConfigDto: {
							guild_id: GUILD_ID,
							setting_type: 'PROPS_ENABLED',
							setting_value: 'false',
						},
					},
				],
			])
			expectSingleV2Reply(interaction)
			const text = replyText(interaction)
			expect(text).toContain('stop from the next run')
			expect(text).toContain('/props enable')
		})
	})

	describe('status', () => {
		const row = (setting_type: string, setting_value: string) => ({
			id: `id-${setting_type}`,
			guild_id: GUILD_ID,
			setting_type,
			setting_value,
		})

		it.each([
			{
				name: 'enabled when PROPS_ENABLED is missing',
				config: [row('PREDICTIONS_CHAN', CHANNEL_ID)],
				expected: 'Daily props: enabled',
			},
			{
				name: "enabled when PROPS_ENABLED is 'true'",
				config: [
					row('PREDICTIONS_CHAN', CHANNEL_ID),
					row('PROPS_ENABLED', 'true'),
				],
				expected: 'Daily props: enabled',
			},
			{
				name: "disabled when PROPS_ENABLED is 'false'",
				config: [
					row('PROPS_ENABLED', 'false'),
					row('PREDICTIONS_CHAN', CHANNEL_ID),
				],
				expected: 'Daily props: disabled',
			},
		])('shows $name, with the channel', async ({ config, expected }) => {
			mockGetGuild.mockResolvedValue({ guild_id: GUILD_ID, config })
			const interaction = makeInteraction()

			await command.handleStatus(interaction as never)

			expect(mockGetGuild).toHaveBeenCalledWith(GUILD_ID)
			expect(mockSetGuildConfig).not.toHaveBeenCalled()
			expectSingleV2Reply(interaction)
			const text = replyText(interaction)
			expect(text).toContain(expected)
			expect(text).toContain(`**Channel:** <#${CHANNEL_ID}>`)
		})

		it.each([
			{ name: 'no config rows', config: [] },
			{ name: 'no config array', config: undefined },
			{
				name: 'only PROPS_ENABLED',
				config: [row('PROPS_ENABLED', 'true')],
			},
		])('shows not set up with $name', async ({ config }) => {
			mockGetGuild.mockResolvedValue({ guild_id: GUILD_ID, config })
			const interaction = makeInteraction()

			await command.handleStatus(interaction as never)

			const text = replyText(interaction)
			expect(text).toContain('Daily props: not set up')
			expect(text).toContain('/props enable')
			expect(text).not.toContain('<#')
		})
	})

	describe('status settings', () => {
		const config = [
			{ setting_type: 'PREDICTIONS_CHAN', setting_value: CHANNEL_ID },
		]

		beforeEach(() => {
			mockGetGuild.mockResolvedValue({ guild_id: GUILD_ID, config })
		})

		it('shows the strategy and post time from the settings row', async () => {
			mockGetSettings.mockResolvedValue({
				guild_id: GUILD_ID,
				strategy: 'smart',
				enabled: true,
				post_time: '17:30',
			})
			const interaction = makeInteraction()

			await command.handleStatus(interaction as never)

			expect(mockGetSettings).toHaveBeenCalledWith(GUILD_ID)
			const text = replyText(interaction)
			expect(text).toContain('**Strategy:** Smart')
			expect(text).toContain('**Post time:** 17:30 UTC')
		})

		it('shows the defaults when the server has no settings row', async () => {
			mockGetSettings.mockResolvedValue(null)
			const interaction = makeInteraction()

			await command.handleStatus(interaction as never)

			const text = replyText(interaction)
			expect(text).toContain('**Strategy:** Default')
			expect(text).toContain('**Post time:** Default schedule')
		})

		it('keeps the existing status and notes settings are unavailable when the call fails', async () => {
			mockGetSettings.mockRejectedValue(
				new PropSettingsError('unavailable'),
			)
			const interaction = makeInteraction()

			await command.handleStatus(interaction as never)

			expectSingleV2Reply(interaction)
			const text = replyText(interaction)
			expect(text).toContain('Daily props: enabled')
			expect(text).toContain(`**Channel:** <#${CHANNEL_ID}>`)
			expect(text).toContain('settings unavailable')
		})
	})

	describe('strategy', () => {
		function strategyInteraction(
			value: string,
			guildId: string | null = GUILD_ID,
		) {
			return {
				...makeInteraction(),
				guildId,
				options: {
					getString: vi.fn(() => value),
				} as unknown as Interaction['options'],
			}
		}

		it.each(['default', 'smart'])(
			'saves %s for the server and confirms',
			async (value) => {
				const interaction = strategyInteraction(value)

				await command.handleStrategy(interaction as never)

				expect(mockSetStrategy).toHaveBeenCalledWith(GUILD_ID, value)
				expect(mockSetGuildConfig).not.toHaveBeenCalled()
				expectSingleV2Reply(interaction)
				expect(replyText(interaction)).toContain(
					'Props strategy updated',
				)
			},
		)

		it.each([
			['rejected', 'not available for this server yet'],
			['forbidden', 'not allowed to change props settings'],
			['unavailable', 'could not save the strategy'],
		] as const)(
			'explains a %s failure in plain words',
			async (reason, copy) => {
				mockSetStrategy.mockRejectedValue(new PropSettingsError(reason))
				const interaction = strategyInteraction('smart')

				await command.handleStrategy(interaction as never)

				const text = replyText(interaction)
				expect(text).toContain('Something went wrong')
				expect(text).toContain(copy)
				expect(text).toContain('Nothing was changed')
				expect(text).not.toContain('Props strategy updated')
			},
		)

		it('does not claim nothing changed when the save is unconfirmed', async () => {
			mockSetStrategy.mockRejectedValue(
				new PropSettingsError('unconfirmed'),
			)
			const interaction = strategyInteraction('smart')

			await command.handleStrategy(interaction as never)

			const text = replyText(interaction)
			expect(text).toContain('could not confirm')
			expect(text).toContain('/props status')
			expect(text).not.toContain('Nothing was changed')
		})

		it('refuses to run outside a server', async () => {
			const interaction = strategyInteraction('smart', null)

			await command.handleStrategy(interaction as never)

			expect(mockSetStrategy).not.toHaveBeenCalled()
			expect(replyText(interaction)).toContain('only works in a server')
		})
	})

	describe('overlapping setup', () => {
		it('does not let a paused enable undo a later failed enable', async () => {
			const gate = deferred()
			mockSetGuildConfig.mockImplementation(
				async (request: ConfigWrite) => {
					const { setting_type, setting_value } =
						request.createConfigDto
					if (setting_type !== 'PREDICTIONS_CHAN') return
					if (setting_value === CHANNEL_ID) await gate.promise
					if (setting_value === OTHER_CHANNEL_ID) {
						throw new Error('channel save failed')
					}
				},
			)
			const first = makeInteraction()
			const second = makeInteraction({ channelId: OTHER_CHANNEL_ID })

			const firstRun = command.handleEnable(first as never)
			// The first request is paused with its channel write in flight.
			await flushMicrotasks()
			expect(writes()).toEqual([
				'PROPS_ENABLED:false',
				`PREDICTIONS_CHAN:${CHANNEL_ID}`,
			])

			const secondRun = command.handleEnable(second as never)
			await flushMicrotasks()
			// The second request must wait for the first to finish.
			expect(writes()).toHaveLength(2)

			gate.resolve()
			await Promise.all([firstRun, secondRun])

			expect(writes()).toEqual([
				'PROPS_ENABLED:false',
				`PREDICTIONS_CHAN:${CHANNEL_ID}`,
				'PROPS_ENABLED:true',
				'PROPS_ENABLED:false',
				`PREDICTIONS_CHAN:${OTHER_CHANNEL_ID}`,
			])
			expect(replyText(first)).toContain('Daily props enabled')
			expect(replyText(second)).toContain('Something went wrong')
			// The failed setup leaves posting off; nothing re-enables it after.
			const recorded = writes()
			expect(recorded[recorded.length - 1]).toBe(
				`PREDICTIONS_CHAN:${OTHER_CHANNEL_ID}`,
			)
			const enabledWrites = recorded.filter((write) =>
				write.startsWith('PROPS_ENABLED'),
			)
			expect(enabledWrites[enabledWrites.length - 1]).toBe(
				'PROPS_ENABLED:false',
			)
		})

		it('runs a disable after the enable it overlapped', async () => {
			const gate = deferred()
			mockSetGuildConfig.mockImplementation(
				async (request: ConfigWrite) => {
					if (
						request.createConfigDto.setting_type ===
						'PREDICTIONS_CHAN'
					) {
						await gate.promise
					}
				},
			)
			const enable = makeInteraction()
			const disable = makeInteraction()

			const enableRun = command.handleEnable(enable as never)
			await flushMicrotasks()
			expect(writes()).toHaveLength(2)

			const disableRun = command.handleDisable(disable as never)
			await flushMicrotasks()
			expect(writes()).toHaveLength(2)

			gate.resolve()
			await Promise.all([enableRun, disableRun])

			expect(writes()).toEqual([
				'PROPS_ENABLED:false',
				`PREDICTIONS_CHAN:${CHANNEL_ID}`,
				'PROPS_ENABLED:true',
				'PROPS_ENABLED:false',
			])
			expect(replyText(disable)).toContain('stop from the next run')
		})
	})
})
