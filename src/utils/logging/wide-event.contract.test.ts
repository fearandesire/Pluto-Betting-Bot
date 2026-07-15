import { describe, expect, it, vi } from 'vitest'

/**
 * Contract v1 shape for Pluto HTTP wide events.
 * (Logic mirrored from createHttpWideEventMiddleware — pure shape check.)
 */
function buildWideEvent(input: {
	method: string
	path: string
	statusCode: number
	durationMs: number
	reqId?: string
	serviceName?: string
}) {
	const outcome =
		input.statusCode >= 200 && input.statusCode < 300
			? 'success'
			: input.statusCode >= 400 && input.statusCode < 500
				? 'client_error'
				: 'server_error'

	return {
		log_type: 'http_request',
		identification: { request_id: input.reqId },
		http: {
			method: input.method,
			path: input.path,
			status_code: input.statusCode,
			duration_ms: input.durationMs,
			outcome,
		},
		client: {
			service_name: input.serviceName ?? 'unknown',
		},
	}
}

describe('wide-event contract shape', () => {
	it('nests http and identification (not flat http_method)', () => {
		const event = buildWideEvent({
			method: 'GET',
			path: '/api/pluto/health',
			statusCode: 200,
			durationMs: 12,
			reqId: 'req_test',
			serviceName: 'khronos',
		})

		expect(event.log_type).toBe('http_request')
		expect(event.identification.request_id).toBe('req_test')
		expect(event.http.method).toBe('GET')
		expect(event.http.status_code).toBe(200)
		expect(event.http.outcome).toBe('success')
		expect(event.client.service_name).toBe('khronos')
		expect((event as Record<string, unknown>).http_method).toBeUndefined()
	})
})

// Silence unused in case of import churn
vi.stubEnv?.('NODE_ENV', process.env.NODE_ENV || 'test')
