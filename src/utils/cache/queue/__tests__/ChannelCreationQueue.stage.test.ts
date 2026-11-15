import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
	handlers: {} as Record<string, (...args: any[]) => unknown>,
}))

vi.mock('bullmq', () => ({
	Queue: class {},
	QueueEvents: class {
		on() {}
	},
	Worker: class {
		on(event: string, handler: (...args: any[]) => unknown) {
			mocks.handlers[event] = handler
		}
	},
}))
vi.mock('../../data/config.js', () => ({ REDIS_CONFIG: {} }))
vi.mock('../../../../lib/telemetry/bullmq-telemetry.js', () => ({
	bullmqTelemetry: () => ({}),
}))
vi.mock('../../../../lib/startup/shutdown-registry.js', () => ({
	registerShutdownQueue: vi.fn(),
}))
vi.mock('../../../guilds/channels/ChannelPresentationService.js', () => ({
	createChannelPresentationService: vi.fn(),
}))
vi.mock('../../../guilds/channels/ChannelManager.js', () => ({
	default: class {},
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

import {
	ChannelCreationBusyError,
	LeaseLostError,
} from '../../../guilds/channels/ChannelCreationWorkflow.js'
import { tagStageFailure } from '../../../logging/game-channel-stage.js'
import { logger } from '../../../logging/WinstonLogger.js'
import { creationFailureReason } from '../ChannelCreationQueue.js'

const job = (attemptsMade: number) => ({
	id: 'job-1',
	name: 'create',
	attemptsMade,
	data: {
		channel: { id: '0f0e0d0c-0b0a-4908-8706-050403020100', sport: 'nfl' },
		guild: { guildId: 'guild-1' },
	},
})

beforeEach(() => vi.clearAllMocks())

describe('channel creation worker game_channel.stage', () => {
	it('reports a failed attempt with retries left as retrying', () => {
		mocks.handlers.failed?.(job(1), new ChannelCreationBusyError())
		expect(logger.warn).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'game_channel.stage',
				stage: 'created',
				outcome: 'retrying',
				reason: 'reservation_busy',
				attempt: 1,
				game_id: '0f0e0d0c0b0a49088706050403020100',
				sport: 'nfl',
				guild_id: 'guild-1',
			}),
		)
	})
	it('reports a post that failed after creation under posted', () => {
		mocks.handlers.failed?.(
			job(1),
			tagStageFailure(new Error('write failed'), {
				stage: 'posted',
				reason: 'post_failed',
			}),
		)
		expect(logger.warn).toHaveBeenCalledWith(
			expect.objectContaining({
				event: 'game_channel.stage',
				stage: 'posted',
				outcome: 'retrying',
				reason: 'post_failed',
				attempt: 1,
				game_id: '0f0e0d0c0b0a49088706050403020100',
			}),
		)
	})
	it('reports the last failed attempt as failed', () => {
		mocks.handlers.failed?.(job(3), new Error('discord said no: token'))
		const stage = vi
			.mocked(logger.error)
			.mock.calls.map(([line]) => line as Record<string, unknown>)
			.find((line) => line.event === 'game_channel.stage')
		expect(stage).toMatchObject({
			outcome: 'failed',
			reason: 'creation_failed',
			attempt: 3,
		})
		expect(JSON.stringify(stage)).not.toContain('token')
	})
})

describe('channel creation worker requestId', () => {
	const stageLine = () =>
		vi
			.mocked(logger.warn)
			.mock.results.map(({ value }) => value as Record<string, unknown>)
			.find((line) => line.event === 'game_channel.stage')

	it('reads it from job.data.metadata.requestId', () => {
		mocks.handlers.failed?.(
			{
				...job(1),
				data: { ...job(1).data, metadata: { requestId: 'cron-abc' } },
			},
			new Error('x'),
		)
		expect(stageLine()).toMatchObject({
			requestId: 'cron-abc',
			job_id: 'job-1',
		})
		expect(stageLine()).not.toHaveProperty('request_id')
	})
	it('is the job id for jobs from older Khronos', () => {
		mocks.handlers.failed?.(job(1), new Error('x'))
		expect(stageLine()?.requestId).toBe('job-1')
	})
	it('drops an unsafe id instead of logging it', () => {
		mocks.handlers.failed?.(
			{
				...job(1),
				data: { ...job(1).data, metadata: { requestId: 'a b\n' } },
			},
			new Error('x'),
		)
		expect(stageLine()?.requestId).toBe('job-1')
	})
})

describe('creationFailureReason', () => {
	it.each([
		[new ChannelCreationBusyError(), 'reservation_busy'],
		[new LeaseLostError(), 'lease_lost'],
		[new Error('Invalid job data: nope'), 'invalid_job_data'],
		[
			new Error('Unsupported channel creation schema'),
			'unsupported_schema',
		],
		[new Error('anything else'), 'creation_failed'],
		[undefined, 'creation_failed'],
	])('maps %s', (error, reason) =>
		expect(creationFailureReason(error)).toBe(reason),
	)
})
