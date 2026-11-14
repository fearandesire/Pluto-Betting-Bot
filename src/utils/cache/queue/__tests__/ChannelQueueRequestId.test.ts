import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	processors: new Map<string, (job: unknown) => Promise<unknown>>(),
}))

vi.mock('bullmq', () => ({
	Queue: class {
		async close() {}
	},
	Worker: class {
		constructor(name: string, process: (job: unknown) => Promise<unknown>) {
			mocks.processors.set(name, process)
		}
		on() {}
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
vi.mock('../../../logging/WinstonLogger.js', () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))
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

import { logger } from '../../../logging/WinstonLogger.js'

await import('../ChannelDeletionQueue.js')
await import('../ChannelPresentationQueue.js')

const stageLines = () =>
	vi
		.mocked(logger.info)
		.mock.calls.map(([line]) => line as Record<string, unknown>)
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

describe('channel deletion job request_id', () => {
	const run = (data: object) =>
		mocks.processors.get('channel-deletion-queue')?.({ id: 'job-d', data })

	it('reads the top-level requestId', async () => {
		await run({ channelName: 'nba-a-vs-b', requestId: 'cron-del-1' })
		expect(stageLines()[0]).toMatchObject({
			stage: 'deleted',
			request_id: 'cron-del-1',
		})
	})
	it('omits it when absent', async () => {
		await run({ channelName: 'nba-a-vs-b' })
		expect(stageLines()).toHaveLength(1)
		expect(stageLines()[0]?.request_id).toBeUndefined()
	})
	it('omits an unsafe id and still runs the job', async () => {
		await run({ channelName: 'nba-a-vs-b', requestId: 'bad id!' })
		expect(stageLines()).toHaveLength(1)
		expect(stageLines()[0]?.request_id).toBeUndefined()
	})
})

describe('channel presentation job request_id', () => {
	const run = (job: object) =>
		mocks.processors.get('channel-presentation-update')?.(job)

	it('reads the top-level requestId the schema strips', async () => {
		await run(presentation({ requestId: 'caller-42' }))
		expect(stageLines()[0]).toMatchObject({
			stage: 'posted',
			request_id: 'caller-42',
		})
	})
	it('omits it when absent', async () => {
		await run(presentation({}))
		expect(stageLines()).toHaveLength(1)
		expect(stageLines()[0]?.request_id).toBeUndefined()
	})
})
