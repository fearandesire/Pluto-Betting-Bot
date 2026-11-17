import { monitorEventLoopDelay } from 'node:perf_hooks'
import { createLogger } from '../../utils/logging/WinstonLogger.js'

// Created on first use, so importing this module has no side effects.
const log = () =>
	createLogger({ component: 'telemetry', handler: 'event-loop' })

export interface EventLoopLagSample {
	p50Ms: number
	p99Ms: number
	maxMs: number
}

/** True when the p99 delay in a window is above the threshold. */
export function isEventLoopLagAlarming(
	sample: EventLoopLagSample,
	thresholdMs: number,
): boolean {
	return sample.p99Ms > thresholdMs
}

const nsToMs = (ns: number) => Math.round((ns / 1e6) * 10) / 10

/**
 * Samples event-loop delay and logs a warning only for windows whose p99 is
 * above the threshold, so a healthy process stays quiet. Returns a stop
 * function. The timer is unref'd so it never keeps the process alive.
 */
export function startEventLoopMonitor({
	intervalMs = 10_000,
	thresholdMs = 200,
}: {
	intervalMs?: number
	thresholdMs?: number
} = {}): () => void {
	const histogram = monitorEventLoopDelay({ resolution: 20 })
	histogram.enable()
	const timer = setInterval(() => {
		const sample: EventLoopLagSample = {
			p50Ms: nsToMs(histogram.percentile(50)),
			p99Ms: nsToMs(histogram.percentile(99)),
			maxMs: nsToMs(histogram.max),
		}
		histogram.reset()
		if (isEventLoopLagAlarming(sample, thresholdMs)) {
			log().warn('Event loop delay above threshold', {
				event: 'process.event_loop_lag',
				...sample,
				thresholdMs,
				intervalMs,
			})
		}
	}, intervalMs)
	timer.unref()
	return () => {
		clearInterval(timer)
		histogram.disable()
	}
}
