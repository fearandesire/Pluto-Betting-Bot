import { readFileSync } from 'node:fs'
import { register } from 'node:module'

// ESM imports are only patched for modules loaded after this hook registers.
register('@opentelemetry/instrumentation/hook.mjs', import.meta.url)

const { getNodeAutoInstrumentations } = await import(
	'@opentelemetry/auto-instrumentations-node'
)
const { OTLPTraceExporter } = await import(
	'@opentelemetry/exporter-trace-otlp-grpc'
)
const { resourceFromAttributes } = await import('@opentelemetry/resources')
const { NodeSDK } = await import('@opentelemetry/sdk-node')
const { BatchSpanProcessor } = await import('@opentelemetry/sdk-trace-base')
const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import(
	'@opentelemetry/semantic-conventions'
)
const { RedactingSpanProcessor } = await import('./span-redaction.js')

const { version } = JSON.parse(
	readFileSync(new URL('../../../package.json', import.meta.url), 'utf-8'),
) as { version: string }

const sdk = new NodeSDK({
	resource: resourceFromAttributes({
		[ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'pluto',
		[ATTR_SERVICE_VERSION]: version,
		'deployment.environment.name': process.env.NODE_ENV ?? 'development',
	}),
	// The exporter reads OTEL_EXPORTER_OTLP_ENDPOINT and the other standard OTEL_* variables.
	spanProcessors: [
		new RedactingSpanProcessor(
			new BatchSpanProcessor(new OTLPTraceExporter()),
		),
	],
	instrumentations: [
		getNodeAutoInstrumentations({
			'@opentelemetry/instrumentation-fs': { enabled: false },
			'@opentelemetry/instrumentation-dns': { enabled: false },
			'@opentelemetry/instrumentation-net': { enabled: false },
			'@opentelemetry/instrumentation-redis': { enabled: false },
			// requestCorrelation in WinstonLogger already writes trace_id and span_id.
			'@opentelemetry/instrumentation-winston': { enabled: false },
		}),
	],
})

try {
	sdk.start()
	console.log(
		JSON.stringify({
			level: 'info',
			msg: 'OpenTelemetry started',
			event: 'otel.started',
		}),
	)
} catch (error) {
	console.error(
		JSON.stringify({
			level: 'error',
			msg: 'OpenTelemetry failed to start; continuing without tracing',
			event: 'otel.start_failed',
			error: error instanceof Error ? error.message : String(error),
		}),
	)
}

process.once('SIGTERM', () => {
	void sdk.shutdown()
})
