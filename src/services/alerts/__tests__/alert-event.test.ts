import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { describe, expect, it } from 'vitest'
import { type AlertTransition, buildAlertEvent } from '../alert-event.js'

const schema = JSON.parse(
	readFileSync(
		resolve('src/services/alerts/testdata/alert-event-v1.schema.json'),
		'utf8',
	),
)
const { $schema: _schema, ...contractSchema } = schema
const AjvConstructor = Ajv as unknown as new (
	options?: object,
) => {
	compile(schemaValue: unknown): unknown
}
const ajv = new AjvConstructor({ allErrors: true })
;(addFormats as unknown as (instance: unknown) => void)(ajv)
const validate = ajv.compile(contractSchema) as ((
	value: unknown,
) => boolean) & {
	errors?: unknown
}

const firing: AlertTransition = {
	state: 'firing',
	key: 'discord.rate_limited',
	scope: 'notification-queue',
	severity: 'warning',
	title: 'Discord delivery is rate limited',
	summary: 'Discord delivery is temporarily rate limited.',
	firedAt: new Date('2026-09-12T20:00:00.000Z'),
	context: { status_code: 429, retryable: true },
}

describe('buildAlertEvent', () => {
	it('builds a firing event accepted by the frozen contract schema', () => {
		const event = buildAlertEvent(firing, {
			version: '4.6.9',
			environment: 'staging',
		})

		expect(validate(event), JSON.stringify(validate.errors)).toBe(true)
		expect(event.fingerprint).toBe(
			'pluto:discord.rate_limited:notification-queue',
		)
	})

	it('keeps severity and key on a resolved transition and excludes internals', () => {
		const event = buildAlertEvent(
			{
				...firing,
				state: 'resolved',
				resolvedAt: new Date('2026-09-12T20:05:00.000Z'),
				context: { status_code: 200 },
			},
			{ version: '4.6.9', environment: 'production' },
		)

		expect(validate(event), JSON.stringify(validate.errors)).toBe(true)
		expect(event.severity).toBe('warning')
		expect(event.key).toBe('discord.rate_limited')
		expect(JSON.stringify(event)).not.toContain('token')
	})
})
