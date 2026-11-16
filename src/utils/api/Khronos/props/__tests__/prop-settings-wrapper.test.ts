import { ResponseError } from '@pluto-khronos/api-client'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../KhronosInstances.js', () => ({ KH_API_CONFIG: {} }))

import PropSettingsWrapper, {
	PropSettingsError,
} from '../prop-settings-wrapper.js'

const GUILD_ID = '123456789012345678'
const row = {
	guild_id: GUILD_ID,
	strategy: 'smart' as const,
	enabled: true,
	post_time: null,
}

const failing = (status: number) =>
	new ResponseError(new Response(null, { status }))

describe('PropSettingsWrapper', () => {
	it('reads the settings row for a guild', async () => {
		const getPropSettings = vi.fn().mockResolvedValue(row)
		const wrapper = new PropSettingsWrapper({
			getPropSettings,
			updatePropSettings: vi.fn(),
		})

		await expect(wrapper.get(GUILD_ID)).resolves.toEqual(row)
		expect(getPropSettings).toHaveBeenCalledWith({ guildId: GUILD_ID })
	})

	it('treats a 404 as no settings row yet', async () => {
		const wrapper = new PropSettingsWrapper({
			getPropSettings: vi.fn().mockRejectedValue(failing(404)),
			updatePropSettings: vi.fn(),
		})

		await expect(wrapper.get(GUILD_ID)).resolves.toBeNull()
	})

	it('sends only the strategy when updating', async () => {
		const updatePropSettings = vi.fn().mockResolvedValue(row)
		const wrapper = new PropSettingsWrapper({
			getPropSettings: vi.fn(),
			updatePropSettings,
		})

		await wrapper.setStrategy(GUILD_ID, 'smart')

		expect(updatePropSettings).toHaveBeenCalledWith({
			guildId: GUILD_ID,
			updateGuildPropSettingsDto: { strategy: 'smart' },
		})
	})

	it.each([
		[400, 'rejected'],
		[401, 'forbidden'],
		[403, 'forbidden'],
		[500, 'unavailable'],
	])('maps HTTP %i to %s', async (status, reason) => {
		const wrapper = new PropSettingsWrapper({
			getPropSettings: vi.fn(),
			updatePropSettings: vi.fn().mockRejectedValue(failing(status)),
		})

		await expect(
			wrapper.setStrategy(GUILD_ID, 'smart'),
		).rejects.toMatchObject({ name: 'PropSettingsError', reason })
	})

	it('reports unavailable when the client has no settings methods', async () => {
		const wrapper = new PropSettingsWrapper({} as never)

		await expect(wrapper.get(GUILD_ID)).rejects.toBeInstanceOf(
			PropSettingsError,
		)
		await expect(wrapper.get(GUILD_ID)).rejects.toMatchObject({
			reason: 'unavailable',
		})
	})
})
