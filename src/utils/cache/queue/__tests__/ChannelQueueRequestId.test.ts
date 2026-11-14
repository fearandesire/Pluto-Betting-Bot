import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	processors: new Map<string, (job: unknown) => Promise<unknown>>(),
	listeners: new Map<string, (...args: unknown[]) => unknown>(),
}))

vi.mock('bullmq', () => ({
	Queue: class {
		async close() {}
	},
	Worker: class {
		constructor(name: string, process: (job: unknown) => Promise<unknown>) {
			mocks.processors.set(name, process)
		}
		on(event: string, listener: (...args: unknown[]) => unknown) {
			mocks.listeners.set(`${mocks.processors.size}:${event}`, listener)
		}
		async pause() {}
		async close() {}
	},
}))
vi.mock('../../data/config.js', () => ({ REDIS_CONFIG: {} }))
vi.mock('../../../../lib/telemetry/bullmq-telemetry.js', () => ({
	bullmqTelemetry: () => ({}),
}))
vi.mock('../../../../lib/startup/shutdown-registry.js', () => ({
	registerShutdownQueue: vi.fn(),
}))
vi.mock('../../../logging/WinstonLogger.js', async () => {
	const { currentJobId, currentRequestId } = await import(
		'../../../../lib/telemetry/request-context.js'
	)
	// The ids the real logger format would add at this moment.
	const log = () =>
		vi.fn((line: object) => ({
			...line,
			requestId: currentRequestId(),
			job_id: currentJobId(),
		}))
	return {
		logger: { info: log(), warn: log(), error: log(), debug: log() },
	}
})
vi.mock('../../../guilds/channels/ChannelManager.js', async () => {
	const { logGameChannelStage } = await import(
		'../../../logging/game-channel-stage.js'
	)
	return {
		default: class {
			async deleteChan(channelName: string) {
				logGameChannelStage({
					stage: 'deleted',
					outcome: 'ok',
					reason: 'deleted',
					channelName,
				})
			}
		},
	}
})
vi.mock('../../../guilds/channels/ChannelPresentationService.js', async () => {
	const { logGameChannelStage } = await import(
		'../../../logging/game-channel-stage.js'
	)
	return {
		createChannelPresentationService: () => ({
			apply: async (_guildId: string, gameId: string) =>
				logGameChannelStage({
					stage: 'posted',
					outcome: 'ok',
					reason: 'posted',
					gameId,
				}),
		}),
	}
})

import { tagStageFailure } from '../../../logging/game-channel-stage.js'
import { logger } from '../../../logging/WinstonLogger.js'

await import('../ChannelDeletionQueue.js')
await import('../ChannelPresentationQueue.js')

const stageLines = () =>
	vi
		.mocked(logger.info)
		.mock.results.map(({ value }) => value as Record<string, unknown>)
		.filter((line) => line.event === 'game_channel.stage')

const GAME = '0f0e0d0c-0b0a-4908-8706-050403020100'
const aggregate = {
	id: GAME,
	sport: 'nba',
	created: false,
	gametime: '2026-10-20T23:00:00Z',
	channelname: 'celtics-at-pistons',
	home_team: 'Detroit Pistons',
	away_team: 'Boston Celtics',
	status: 'scheduled',
	schedule_provider: 'espn',
	schedule_observed_at: '2026-10-20T22:00:00Z',
	schedule_snapshot_ref: 'fixture-accepted-snapshot',
	betting: { state: 'unavailable', reason: 'no_markets' },
	initial_odds_completion: {
		revision: 1,
		completion_id: '00000000-0000-4000-8000-000000000002',
		event_id: GAME,
		sport: 'basketball_nba',
		market: 'h2h',
		completed: true,
		status: 'confirmed_empty',
		completed_at: '2026-10-20T22:29:00Z',
	},
}
const presentation = (extra: object) => ({
	id: 'job-p',
	data: {
		schemaVersion: 1,
		gameId: GAME,
		guildId: 'guild-1',
		revision: 1,
		presentation: aggregate,
		...extra,
	},
})

beforeEach(() => vi.clearAllMocks())

describe('channel deletion job requestId', () => {
	const run = (data: object) =>
		mocks.processors.get('channel-deletion-queue')?.({ id: 'job-d', data })

	it('is the top-level upstream id, with the BullMQ id as job_id', async () => {
		await run({ channelName: 'nba-a-vs-b', requestId: 'cron-del-1' })
		expect(stageLines()[0]).toMatchObject({
			stage: 'deleted',
			requestId: 'cron-del-1',
			job_id: 'job-d',
		})
		expect(stageLines()[0]).not.toHaveProperty('request_id')
	})
	it('is the job id when the payload has none', async () => {
		await run({ channelName: 'nba-a-vs-b' })
		expect(stageLines()).toHaveLength(1)
		expect(stageLines()[0]).toMatchObject({
			requestId: 'job-d',
			job_id: 'job-d',
		})
	})
	it('ignores an unsafe id and still runs the job', async () => {
		await run({ channelName: 'nba-a-vs-b', requestId: 'bad id!' })
		expect(stageLines()).toHaveLength(1)
		expect(stageLines()[0]?.requestId).toBe('job-d')
	})
})

describe('channel presentation job requestId', () => {
	const run = (job: object) =>
		mocks.processors.get('channel-presentation-update')?.(job)

	it('reads the top-level requestId the schema strips', async () => {
		await run(presentation({ requestId: 'caller-42' }))
		expect(stageLines()[0]).toMatchObject({
			stage: 'posted',
			requestId: 'caller-42',
			job_id: 'job-p',
		})
	})
	it('is the job id when absent', async () => {
		await run(presentation({}))
		expect(stageLines()).toHaveLength(1)
		expect(stageLines()[0]?.requestId).toBe('job-p')
	})
})

describe('channel presentation worker failures', () => {
	// The presentation worker is the second Worker constructed in this file.
	const onFailed = () => mocks.listeners.get('2:failed')
	const levelLines = (level: 'warn' | 'error') =>
		vi
			.mocked(logger[level])
			.mock.results.map(({ value }) => value as Record<string, unknown>)
			.filter((line) => line?.event === 'game_channel.stage')

	it('reports an update failure as a posting failure', () => {
		onFailed()?.(
			{ ...presentation({}), attemptsMade: 1, opts: { attempts: 1 } },
			new Error('Presentation update has no confirmed channel'),
		)
		expect(levelLines('error')).toEqual([
			expect.objectContaining({
				stage: 'posted',
				outcome: 'failed',
				reason: 'post_failed',
				game_id: GAME.replaceAll('-', ''),
				guild_id: 'guild-1',
				requestId: 'job-p',
			}),
		])
	})
	it('keeps the stage and reason a tagged error carries', () => {
		onFailed()?.(
			{ ...presentation({}), attemptsMade: 1, opts: { attempts: 3 } },
			tagStageFailure(new Error('lost'), {
				stage: 'posted',
				reason: 'lease_lost',
				gameId: GAME,
			}),
		)
		expect(levelLines('warn')).toEqual([
			expect.objectContaining({
				stage: 'posted',
				outcome: 'retrying',
				reason: 'lease_lost',
				attempt: 1,
			}),
		])
	})
})
