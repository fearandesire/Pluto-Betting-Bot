import { describe, expect, it } from 'vitest'
import { resolveOtelEnvWiring } from '#lib/observability/otel-wiring.js'

describe('otel env wiring', () => {
	it('defaults Alloy OTLP endpoint and service name', () => {
		const wiring = resolveOtelEnvWiring({})
		expect(wiring.serviceName).toBe('pluto')
		expect(wiring.endpoint).toBe('http://host.docker.internal:4317')
		expect(wiring.insecure).toBe(true)
		expect(wiring.sdkDisabled).toBe(false)
	})

	it('honors OTEL_* overrides', () => {
		const wiring = resolveOtelEnvWiring({
			OTEL_SERVICE_NAME: 'pluto_api',
			OTEL_EXPORTER_OTLP_ENDPOINT: 'http://alloy:4317',
			OTEL_EXPORTER_OTLP_INSECURE: 'false',
			OTEL_SDK_DISABLED: 'true',
		})
		expect(wiring.serviceName).toBe('pluto_api')
		expect(wiring.endpoint).toBe('http://alloy:4317')
		expect(wiring.insecure).toBe(false)
		expect(wiring.sdkDisabled).toBe(true)
	})
})
