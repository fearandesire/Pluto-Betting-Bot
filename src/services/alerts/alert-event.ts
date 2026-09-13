export type AlertState = 'firing' | 'resolved'
export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface AlertTransition {
	state: AlertState
	key: string
	scope: string
	severity: AlertSeverity
	title: string
	summary: string
	firedAt: Date
	resolvedAt?: Date
	suppressedCount?: number
	context?: Record<string, string | number | boolean | null>
}

export interface AlertEvent {
	schema_version: 1
	service: 'pluto'
	version: string
	environment: 'production' | 'staging' | 'development' | 'test'
	severity: AlertSeverity
	key: string
	scope: string
	fingerprint: string
	state: AlertState
	title: string
	summary: string
	fired_at: string
	resolved_at?: string
	suppressed_count?: number
	context?: Record<string, string | number | boolean | null>
}

const allowedKeys = new Set([
	'delivery.failed',
	'khronos.unreachable',
	'gateway.disconnected',
	'discord.rate_limited',
])

export function buildAlertEvent(
	transition: AlertTransition,
	options: {
		version: string
		environment: string
	},
): AlertEvent {
	if (!allowedKeys.has(transition.key)) {
		throw new Error(`Unsupported Pluto alert key: ${transition.key}`)
	}
	if (transition.state === 'resolved' && !transition.resolvedAt) {
		throw new Error('Resolved alert events require resolvedAt')
	}
	if (transition.state === 'firing' && transition.resolvedAt) {
		throw new Error('Firing alert events must not carry resolvedAt')
	}
	const environment = normalizeEnvironment(options.environment)
	const event: AlertEvent = {
		schema_version: 1,
		service: 'pluto',
		version: options.version.trim().slice(0, 128) || 'unknown',
		environment,
		severity: transition.severity,
		key: transition.key,
		scope: normalizeIdentity(transition.scope),
		fingerprint: `pluto:${transition.key}:${normalizeIdentity(transition.scope)}`,
		state: transition.state,
		title: transition.title.trim().slice(0, 160),
		summary: transition.summary.trim().slice(0, 1024),
		fired_at: transition.firedAt.toISOString(),
	}
	if (transition.resolvedAt)
		event.resolved_at = transition.resolvedAt.toISOString()
	if (transition.suppressedCount !== undefined) {
		event.suppressed_count = Math.max(
			0,
			Math.trunc(transition.suppressedCount),
		)
	}
	if (transition.context && Object.keys(transition.context).length > 0) {
		event.context = safeContext(transition.context)
	}
	return event
}

function normalizeEnvironment(value: string): AlertEvent['environment'] {
	switch (value.trim().toLowerCase()) {
		case 'staging':
			return 'staging'
		case 'development':
		case 'debug':
			return 'development'
		case 'test':
			return 'test'
		default:
			return 'production'
	}
}

function normalizeIdentity(value: string): string {
	const normalized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9_-]+/g, '_')
		.replace(/^_+|_+$/g, '')
	return normalized || 'global'
}

function safeContext(
	context: Record<string, string | number | boolean | null>,
): Record<string, string | number | boolean | null> {
	const forbidden =
		/(password|secret|token|api_?key|authorization|cookie|request_?body|response_?body)/i
	return Object.fromEntries(
		Object.entries(context)
			.filter(
				([key]) =>
					/^[a-z][a-z0-9_]*$/.test(key) && !forbidden.test(key),
			)
			.slice(0, 24)
			.map(([key, value]) => [
				key,
				typeof value === 'string' ? value.slice(0, 512) : value,
			]),
	)
}
