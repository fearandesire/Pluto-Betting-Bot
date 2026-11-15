import { PassThrough } from 'node:stream'
import { trace } from '@opentelemetry/api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as winston from 'winston'

vi.mock('#lib/startup/env.js', () => ({
	default: { NODE_ENV: 'test', LOG_LEVEL: 'Info', PROJECT_VERSION: '0.0.0' },
}))

const { createLogger, logger } = await import('../WinstonLogger.js')
const { runWithRequestId, withJobEventRequestId, withJobRequestId } =
	await import('#lib/telemetry/request-context.js')
const { logGameChannelStage } = await import('../game-channel-stage.js')

const captured: Record<string, unknown>[] = []
const stream = new PassThrough({ objectMode: true })
stream.on('data', (info) => captured.push(info))
logger.clear().add(new winston.transports.Stream({ stream }))

afterEach(() => {
	captured.length = 0
	vi.restoreAllMocks()
})

describe('requestCorrelation', () => {
	it('adds the active requestId to every line, child loggers included', () => {
		runWithRequestId('1234567890123456789', () => {
			createLogger({ handler: 'test' }).info('handled', { event: 'a.b' })
		})
		expect(captured[0]).toMatchObject({
			requestId: '1234567890123456789',
			handler: 'test',
			event: 'a.b',
		})
	})

	it('keeps a requestId the caller passed', () => {
		runWithRequestId('ctx', () =>
			logger.info('x', { requestId: 'explicit' }),
		)
		expect(captured[0]?.requestId).toBe('explicit')
	})

	it('adds no correlation fields outside a request or span', () => {
		logger.info('startup')
		expect(captured[0]).not.toHaveProperty('requestId')
		expect(captured[0]).not.toHaveProperty('trace_id')
	})

	it('adds trace_id and span_id from the active span', () => {
		vi.spyOn(trace, 'getActiveSpan').mockReturnValue(
			trace.wrapSpanContext({
				traceId: '0af7651916cd43dd8448eb211c80319c',
				spanId: 'b7ad6b7169203331',
				traceFlags: 1,
			}),
		)
		logger.info('traced')
		expect(captured[0]).toMatchObject({
			trace_id: '0af7651916cd43dd8448eb211c80319c',
			span_id: 'b7ad6b7169203331',
		})
	})

	it('tags a failed-job line from a worker listener with the job id', () => {
		const onFailed = withJobEventRequestId(
			(_job: { id?: string } | undefined, error: Error) => {
				logger.error('Delivery job failed', {
					event: 'notification.delivery.job_failed',
					error: error.message,
				})
			},
			undefined,
		)
		onFailed({ id: '550e8400-e29b-41d4-a716-446655440111' }, new Error('x'))
		onFailed(undefined, new Error('y'))

		expect(captured[0]).toMatchObject({
			event: 'notification.delivery.job_failed',
			requestId: '550e8400-e29b-41d4-a716-446655440111',
		})
		expect(captured[1]).not.toHaveProperty('requestId')
	})

	it('uses the upstream run id as requestId and the BullMQ id as job_id in a job', async () => {
		const process = withJobRequestId(
			async (_job: { id: string; upstream?: string }) =>
				logGameChannelStage({
					stage: 'created',
					outcome: 'ok',
					reason: 'created',
				}),
			(job) => job.upstream,
		)
		await process({ id: '42', upstream: 'cron-6f1c2d1e' })
		await process({ id: '43' })
		logger.info('outside')

		expect(captured[0]).toMatchObject({
			event: 'game_channel.stage',
			requestId: 'cron-6f1c2d1e',
			job_id: '42',
		})
		expect(captured[0]).not.toHaveProperty('request_id')
		expect(captured[1]).toMatchObject({ requestId: '43', job_id: '43' })
		expect(captured[2]).not.toHaveProperty('job_id')
	})

	it('gives a worker listener the same ids as its processor', () => {
		const onFailed = withJobEventRequestId(
			(_job: { id: string; upstream?: string }) => logger.warn('failed'),
			(job) => job.upstream,
		)
		onFailed({ id: '42', upstream: 'cron-6f1c2d1e' })
		expect(captured[0]).toMatchObject({
			requestId: 'cron-6f1c2d1e',
			job_id: '42',
		})
	})
})
