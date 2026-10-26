import { beforeEach, describe, expect, it, vi } from 'vitest'

const bull = vi.hoisted(() => ({
	upsertJobScheduler: vi.fn(),
	add: vi.fn(),
	processor: undefined as
		| undefined
		| ((job: { data: object; attemptsMade: number }) => Promise<unknown>),
}))
const refreshMatches = vi.hoisted(() => vi.fn())

vi.mock('bullmq', () => ({
	Queue: vi.fn(function () {
		return { upsertJobScheduler: bull.upsertJobScheduler, add: bull.add }
	}),
	Worker: vi.fn(function (_name: string, processor: typeof bull.processor) {
		bull.processor = processor
		return { on: vi.fn() }
	}),
}))
vi.mock('../../data/config.js', () => ({ REDIS_CONFIG: {} }))
vi.mock('../../cache-manager.js', () => ({ CacheManager: vi.fn() }))
vi.mock('../../../../lib/startup/shutdown-registry.js', () => ({
	registerShutdownQueue: vi.fn(),
}))
vi.mock('../../../logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))
vi.mock('../../../api/routes/cache/match-cache-service.js', () => ({
	default: vi.fn(function () {
		return { refreshMatches }
	}),
}))

import { MatchRefreshQueue } from '../match-refresh-queue.js'

describe('MatchRefreshQueue', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('upserts the same recurring scheduler on every start', async () => {
		const queue = new MatchRefreshQueue()
		await queue.start()
		await queue.start()

		expect(bull.upsertJobScheduler).toHaveBeenCalledTimes(2)
		for (const [id, repeat] of bull.upsertJobScheduler.mock.calls) {
			expect(id).toBe('match-refresh-interval')
			expect(repeat).toEqual({ every: 5 * 60 * 1000 })
		}
	})

	it('runs a startup refresh without a fixed job id', async () => {
		await new MatchRefreshQueue().start()

		expect(bull.add).toHaveBeenCalledWith('refresh', { reason: 'startup' })
	})

	it('completes successfully when Khronos has no matches', async () => {
		new MatchRefreshQueue()
		refreshMatches.mockResolvedValue(0)

		await expect(
			bull.processor?.({ data: {}, attemptsMade: 0 }),
		).resolves.toEqual({ success: true, matchCount: 0 })
	})
})
