/**
 * OpenTelemetry wiring for Pluto → Atlas Alloy OTLP.
 *
 * Packages are not added in this PR (deps churn). Wire Alloy endpoints via
 * env so a follow-up can enable NodeSDK without rediscovering config.
 *
 * TODO(obs): add `@opentelemetry/sdk-node` + OTLP exporters and start SDK
 * when `OTEL_SDK_DISABLED` is not `true`. Prefer gRPC `:4317` (or HTTP `:4318`)
 * to host Alloy — mirror khronos `instrumentation.ts`.
 *
 * Required envs (Atlas):
 * - OTEL_SERVICE_NAME=pluto (or pluto_api / pluto_bot)
 * - OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4317
 * - OTEL_EXPORTER_OTLP_INSECURE=true (local Alloy)
 * - OTEL_TRACES_EXPORTER=otlp
 * - OTEL_METRICS_EXPORTER=otlp
 * - OTEL_PROPAGATORS=tracecontext,baggage
 */

export type OtelEnvWiring = {
	serviceName: string
	endpoint: string
	insecure: boolean
	sdkDisabled: boolean
}

export function resolveOtelEnvWiring(
	env: NodeJS.ProcessEnv = process.env,
): OtelEnvWiring {
	return {
		serviceName: env.OTEL_SERVICE_NAME || env.SERVICE_NAME || 'pluto',
		endpoint:
			env.OTEL_EXPORTER_OTLP_ENDPOINT ||
			env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
			'http://host.docker.internal:4317',
		insecure:
			env.OTEL_EXPORTER_OTLP_INSECURE === undefined
				? true
				: env.OTEL_EXPORTER_OTLP_INSECURE === 'true',
		sdkDisabled: env.OTEL_SDK_DISABLED === 'true',
	}
}

/** No-op until OTEL packages land; call from index startup for forward compat. */
export function bootstrapOtelPlaceholder(): OtelEnvWiring {
	const wiring = resolveOtelEnvWiring()
	if (!wiring.sdkDisabled && process.env.NODE_ENV === 'production') {
		// Intentional: stdout note only; not pretty-printed into Nest formatters.
		console.info(
			JSON.stringify({
				level: 'info',
				message: 'otel sdk not started — packages pending',
				log_type: 'startup',
				service: wiring.serviceName,
				deployment: {
					service: wiring.serviceName,
					environment: process.env.NODE_ENV,
				},
				otel: {
					endpoint: wiring.endpoint,
					insecure: wiring.insecure,
					todo: 'enable NodeSDK export to Alloy',
				},
			}),
		)
	}
	return wiring
}
