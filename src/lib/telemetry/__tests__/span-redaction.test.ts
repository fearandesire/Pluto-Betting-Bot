import {
	BasicTracerProvider,
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { describe, expect, it } from 'vitest'
import { RedactingSpanProcessor, redactDiscordIds } from '../span-redaction.js'

const USER = '368578308872601602'

describe('RedactingSpanProcessor', () => {
	it('redacts Discord ids from the name and URL attributes and drops client IPs', () => {
		const exporter = new InMemorySpanExporter()
		const provider = new BasicTracerProvider({
			spanProcessors: [
				new RedactingSpanProcessor(new SimpleSpanProcessor(exporter)),
			],
		})
		provider
			.getTracer('test')
			.startSpan(`GET /betslips/user/${USER}`, {
				attributes: {
					'url.full': `http://khronos_api:2088/betslips/user/${USER}?guild=555171631539028000`,
					'http.target': `/betslips/user/${USER}`,
					'http.route': `/betslips/user/${USER}`,
					'client.address': '203.0.113.9',
					'http.client_ip': '203.0.113.9',
					'discord.user.id': USER,
					'http.status_code': 200,
				},
			})
			.end()

		const [span] = exporter.getFinishedSpans()
		expect(span?.name).toBe('GET /betslips/user/:id')
		expect(span?.attributes).toEqual({
			'url.full': 'http://khronos_api:2088/betslips/user/:id?guild=:id',
			'http.target': '/betslips/user/:id',
			'http.route': '/betslips/user/:id',
			'discord.user.id': USER,
			'http.status_code': 200,
		})
		expect(span?.spanContext().traceId).toMatch(/^[0-9a-f]{32}$/)
	})
})

describe('redactDiscordIds', () => {
	it('leaves shorter numbers alone', () => {
		expect(redactDiscordIds('/props/daily?limit=25&ts=1731400000000')).toBe(
			'/props/daily?limit=25&ts=1731400000000',
		)
	})
})
