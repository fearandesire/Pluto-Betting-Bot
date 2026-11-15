import { isTracingEnabled } from './lib/telemetry/tracing-flag.js'

// Preloaded with `node --import ./dist/instrumentation.js`. With the flag off, no OpenTelemetry SDK code loads.
if (isTracingEnabled()) {
	await import('./lib/telemetry/otel-sdk.js')
}
