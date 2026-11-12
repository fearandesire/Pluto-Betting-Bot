import type { Context } from '@opentelemetry/api'
import type {
	ReadableSpan,
	Span,
	SpanProcessor,
} from '@opentelemetry/sdk-trace-base'

const DISCORD_ID = /(?<!\d)\d{17,20}(?!\d)/g

const REDACTED_ATTRIBUTES = [
	'db.query.text',
	'db.statement',
	'http.route',
	'http.target',
	'http.url',
	'url.path',
	'url.full',
	'url.query',
]

/** Behind Cloudflare these hold the user's IP, not a peer we own. */
const CLIENT_ADDRESS_ATTRIBUTES = [
	'client.address',
	'http.client_ip',
	'net.peer.ip',
	'net.sock.peer.addr',
	'network.peer.address',
]

export const redactDiscordIds = (value: string): string =>
	value.replace(DISCORD_ID, ':id')

export function redactSpan(span: ReadableSpan): ReadableSpan {
	const attributes = { ...span.attributes }
	for (const key of REDACTED_ATTRIBUTES) {
		const value = attributes[key]
		if (typeof value === 'string') attributes[key] = redactDiscordIds(value)
	}
	for (const key of CLIENT_ADDRESS_ATTRIBUTES) delete attributes[key]
	return Object.create(span, {
		name: { value: redactDiscordIds(span.name) },
		attributes: { value: attributes },
	})
}

/**
 * Keeps Discord ids out of span names, URL and query attributes (D11). The user id
 * stays in the one explicit `discord.user.id` attribute.
 */
export class RedactingSpanProcessor implements SpanProcessor {
	constructor(private readonly next: SpanProcessor) {}

	onStart(span: Span, parentContext: Context): void {
		this.next.onStart(span, parentContext)
	}

	onEnd(span: ReadableSpan): void {
		this.next.onEnd(redactSpan(span))
	}

	forceFlush(): Promise<void> {
		return this.next.forceFlush()
	}

	shutdown(): Promise<void> {
		return this.next.shutdown()
	}
}
