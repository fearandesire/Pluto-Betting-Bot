import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../logging/WinstonLogger.js', () => ({
	logger: {
		info: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
		debug: vi.fn(),
	},
}))

import { logger } from '../../logging/WinstonLogger.js'
import {
	PropsCronScheduler,
	type ServedGuild,
	type ServedGuildsProvider,
} from '../PropsCronScheduler.js'
import type { PropsCronService } from '../PropsCronService.js'

function makeCronService(failFor: string[] = []) {
	const cacheActivePropIds = vi.fn(async (guildId: string) => {
		if (failFor.includes(guildId)) {
			throw new Error(`khronos down for ${guildId}`)
		}
	})
	const cacheAllProps = vi.fn(async () => {})
	return {
		service: {
			cacheActivePropIds,
			cacheAllProps,
		} as unknown as PropsCronService,
		cacheActivePropIds,
	}
}

const guild = (id: string, available = true): ServedGuild => ({ id, available })

function loggedMessages(level: 'info' | 'warn') {
	return vi.mocked(logger[level]).mock.calls.map(([entry]) => entry)
}

afterEach(() => {
	vi.clearAllMocks()
	vi.useRealTimers()
	vi.unstubAllEnvs()
})

describe('PropsCronScheduler active props', () => {
	it('caches every served guild without a GUILD_ID env', async () => {
		vi.stubEnv('GUILD_ID', '')
		const { service, cacheActivePropIds } = makeCronService()
		const scheduler = new PropsCronScheduler(service, () => [
			guild('111'),
			guild('222'),
		])

		const summary = await scheduler.cacheActivePropsForServedGuilds()

		expect(cacheActivePropIds.mock.calls).toEqual([['111'], ['222']])
		expect(summary).toEqual({
			cached: ['111', '222'],
			skipped: [],
			failed: [],
		})
	})

	it('keeps caching the other guilds when one guild fails', async () => {
		const { service, cacheActivePropIds } = makeCronService(['111'])
		const scheduler = new PropsCronScheduler(service, () => [
			guild('111'),
			guild('222'),
			guild('333'),
		])

		const summary = await scheduler.cacheActivePropsForServedGuilds()

		expect(cacheActivePropIds).toHaveBeenCalledTimes(3)
		expect(summary?.cached).toEqual(['222', '333'])
		expect(summary?.failed).toEqual([
			{ guildId: '111', error: 'khronos down for 111' },
		])
		expect(loggedMessages('warn')).toContainEqual(
			expect.objectContaining({
				message: 'Active props caching job completed',
				metadata: expect.objectContaining({
					failedGuildIds: ['111'],
					cachedCount: 2,
				}),
			}),
		)
	})

	it('skips an unavailable guild with a warning and caches the rest', async () => {
		const { service, cacheActivePropIds } = makeCronService()
		const scheduler = new PropsCronScheduler(service, () => [
			guild('111', false),
			guild('222'),
		])

		const summary = await scheduler.cacheActivePropsForServedGuilds()

		expect(cacheActivePropIds.mock.calls).toEqual([['222']])
		expect(summary?.skipped).toEqual([
			{ guildId: '111', reason: 'guild_unavailable' },
		])
		expect(loggedMessages('warn')).toContainEqual(
			expect.objectContaining({
				message: 'active_props_guild_skipped',
				metadata: expect.objectContaining({
					guildId: '111',
					reason: 'guild_unavailable',
				}),
			}),
		)
	})

	it('logs why a run is skipped before the client is ready', async () => {
		const { service, cacheActivePropIds } = makeCronService()
		const scheduler = new PropsCronScheduler(service, () => null)

		await scheduler.cacheActivePropsForServedGuilds()

		expect(cacheActivePropIds).not.toHaveBeenCalled()
		expect(loggedMessages('info')).toContainEqual(
			expect.objectContaining({
				message: 'active_props_run_skipped',
				metadata: expect.objectContaining({
					reason: 'client_not_ready',
				}),
			}),
		)
	})

	it('picks up guilds joined and left after startup on the next run', async () => {
		vi.useFakeTimers()
		const served: ServedGuild[] = [guild('111')]
		const provider: ServedGuildsProvider = () => [...served]
		const { service, cacheActivePropIds } = makeCronService()
		const scheduler = new PropsCronScheduler(service, provider)

		await scheduler.start()
		await vi.advanceTimersByTimeAsync(0)
		expect(cacheActivePropIds.mock.calls).toEqual([['111']])

		served.splice(0, 1, guild('222'))
		cacheActivePropIds.mockClear()
		await vi.advanceTimersByTimeAsync(5 * 60 * 1000)

		expect(cacheActivePropIds.mock.calls).toEqual([['222']])
		expect(loggedMessages('warn')).not.toContainEqual(
			expect.objectContaining({
				message: expect.stringContaining('GUILD_ID'),
			}),
		)
		await scheduler.stop()
	})

	it('does not start a second run while one is still in progress', async () => {
		let release: () => void = () => {}
		const { service, cacheActivePropIds } = makeCronService()
		cacheActivePropIds.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					release = resolve
				}),
		)
		const scheduler = new PropsCronScheduler(service, () => [guild('111')])

		const first = scheduler.cacheActivePropsForServedGuilds()
		await expect(
			scheduler.cacheActivePropsForServedGuilds(),
		).resolves.toBeNull()
		release()
		await first

		expect(cacheActivePropIds).toHaveBeenCalledTimes(1)
	})
})
