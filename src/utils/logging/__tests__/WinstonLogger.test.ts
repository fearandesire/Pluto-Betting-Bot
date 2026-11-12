import { afterEach, describe, expect, it, vi } from 'vitest'
import Transport from 'winston-transport'
import { createLogger, logger } from '../WinstonLogger.js'

vi.mock('#lib/startup/env.js', () => ({
	default: { LOG_LEVEL: 'Info', NODE_ENV: 'test', PROJECT_VERSION: '0.0.0' },
}))

class CaptureTransport extends Transport {
	readonly entries: Record<string, unknown>[] = []

	override log(info: Record<string, unknown>, next: () => void) {
		this.entries.push(info)
		next()
	}
}

describe('WinstonLogger component precedence', () => {
	const capture = new CaptureTransport()
	logger.clear().add(capture)

	afterEach(() => {
		capture.entries.length = 0
	})

	it('keeps the component bound on a child logger', () => {
		createLogger({ component: 'khronos-client' }).info('probe')

		expect(capture.entries[0]?.component).toBe('khronos-client')
	})

	it('lets a per-call component override the child logger', () => {
		createLogger({ component: 'khronos-client' }).info('probe', {
			component: 'per-call',
		})

		expect(capture.entries[0]?.component).toBe('per-call')
	})

	it('falls back to bot when nothing sets a component', () => {
		logger.info('probe')

		expect(capture.entries[0]?.component).toBe('bot')
	})
})
