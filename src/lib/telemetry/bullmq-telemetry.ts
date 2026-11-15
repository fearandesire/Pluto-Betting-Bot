import { BullMQOtel } from 'bullmq-otel'
import { isTracingEnabled } from './tracing-flag.js'

/** Spread into Queue and Worker options; BullMQ carries the trace context in job options. */
export const bullmqTelemetry = (): { telemetry?: BullMQOtel } =>
	isTracingEnabled()
		? { telemetry: new BullMQOtel({ tracerName: 'pluto' }) }
		: {}
