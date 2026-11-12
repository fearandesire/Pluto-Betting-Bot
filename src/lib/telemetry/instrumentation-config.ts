import type { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'

/** Redis keys embed guild, channel and user ids; the command name is enough to read a trace. */
export const redisCommandOnly = (command: string, _args: unknown[]): string =>
	command

export const AUTO_INSTRUMENTATION_CONFIG = {
	'@opentelemetry/instrumentation-fs': { enabled: false },
	'@opentelemetry/instrumentation-dns': { enabled: false },
	'@opentelemetry/instrumentation-net': { enabled: false },
	'@opentelemetry/instrumentation-redis': { enabled: false },
	'@opentelemetry/instrumentation-ioredis': {
		dbStatementSerializer: redisCommandOnly,
	},
	// requestCorrelation in WinstonLogger already writes trace_id and span_id.
	'@opentelemetry/instrumentation-winston': { enabled: false },
} satisfies Parameters<typeof getNodeAutoInstrumentations>[0]
