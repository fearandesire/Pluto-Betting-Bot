import {
	BasicTracerProvider,
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { describe, expect, it } from 'vitest'
import {
	AUTO_INSTRUMENTATION_CONFIG,
	redisCommandOnly,
} from '../instrumentation-config.js'
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

describe('Redis spans', () => {
	const ledgerKey = 'pluto:game-channel-owner:v1:1300000000000000001'

	it('export the command name only', () => {
		const serializer =
			AUTO_INSTRUMENTATION_CONFIG[
				'@opentelemetry/instrumentation-ioredis'
			].dbStatementSerializer
		expect(serializer).toBe(redisCommandOnly)
		expect(redisCommandOnly('get', [ledgerKey])).toBe('get')
	})

	it('redact ids from db statements another serializer kept', () => {
		const exporter = new InMemorySpanExporter()
		new BasicTracerProvider({
			spanProcessors: [
				new RedactingSpanProcessor(new SimpleSpanProcessor(exporter)),
			],
		})
			.getTracer('test')
			.startSpan('get', {
				attributes: {
					'db.statement': `get ${ledgerKey}`,
					'db.query.text': `get ${ledgerKey}`,
				},
			})
			.end()

		expect(exporter.getFinishedSpans()[0]?.attributes).toEqual({
			'db.statement': 'get pluto:game-channel-owner:v1::id',
			'db.query.text': 'get pluto:game-channel-owner:v1::id',
		})
	})
})

describe('Discord token URLs', () => {
	const TOKEN = 'fake-interaction-token_for-tests'
	const INTERACTION = '1300000000000000001'
	const APP = '1200000000000000002'

	it.each([
		[
			`https://discord.com/api/v10/interactions/${INTERACTION}/${TOKEN}/callback`,
			'https://discord.com/api/v10/interactions/:id/{token}/callback',
		],
		[
			`/api/v10/interactions/${INTERACTION}/${TOKEN}/callback?with_response=true`,
			'/api/v10/interactions/:id/{token}/callback?with_response=true',
		],
		[
			`https://discord.com/api/v10/webhooks/${APP}/${TOKEN}/messages/@original`,
			'https://discord.com/api/v10/webhooks/:id/{token}/messages/@original',
		],
		[
			`/api/v10/webhooks/${APP}/${TOKEN}/messages/${INTERACTION}`,
			'/api/v10/webhooks/:id/{token}/messages/:id',
		],
		[`/webhooks/${APP}/${TOKEN}`, '/webhooks/:id/{token}'],
		[
			`/interactions/${INTERACTION}/${TOKEN}/callback`,
			'/interactions/:id/{token}/callback',
		],
	])('redacts the token in %s', (input, expected) => {
		const output = redactDiscordIds(input)
		expect(output).toBe(expected)
		expect(output).not.toContain(TOKEN)
	})

	it('keeps tokens out of exported span names and URL attributes', () => {
		const exporter = new InMemorySpanExporter()
		const url = `https://discord.com/api/v10/webhooks/${APP}/${TOKEN}/messages/@original`
		const path = `/api/v10/webhooks/${APP}/${TOKEN}/messages/@original`
		new BasicTracerProvider({
			spanProcessors: [
				new RedactingSpanProcessor(new SimpleSpanProcessor(exporter)),
			],
		})
			.getTracer('test')
			.startSpan(`PATCH ${path}`, {
				attributes: {
					'url.full': url,
					'http.url': url,
					'url.path': path,
					'http.target': path,
				},
			})
			.end()

		const [span] = exporter.getFinishedSpans()
		expect(
			JSON.stringify({ name: span?.name, ...span?.attributes }),
		).not.toContain(TOKEN)
		expect(span?.attributes['url.full']).toBe(
			'https://discord.com/api/v10/webhooks/:id/{token}/messages/@original',
		)
	})
})

describe('redactDiscordIds', () => {
	it('leaves shorter numbers alone', () => {
		expect(redactDiscordIds('/props/daily?limit=25&ts=1731400000000')).toBe(
			'/props/daily?limit=25&ts=1731400000000',
		)
	})
})
