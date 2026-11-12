import { PassThrough } from 'node:stream'
import { trace } from '@opentelemetry/api'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as winston from 'winston'

vi.mock('#lib/startup/env.js', () => ({
	default: { NODE_ENV: 'test', LOG_LEVEL: 'Info', PROJECT_VERSION: '0.0.0' },
}))

const { createLogger, logger } = await import('../WinstonLogger.js')
const { runWithRequestId } = await import('#lib/telemetry/request-context.js')

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
})
