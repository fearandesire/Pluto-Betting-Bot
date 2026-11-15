import cors from '@koa/cors'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { logger } from 'koa2-winston'
import { createConsoleTransport } from './../../../logging/transports/consoleTransport.js'
import { pageNotFound } from '../../requests/middleware.js'
import { createApiKeyAuthMiddleware } from './apiKeyAuth.js'
import { setupBullBoard } from './bullBoard.js'
import { createErrorHandler } from './errorHandler.js'
import { createHealthMiddleware } from './health.js'
import { createRequestIdMiddleware } from './requestId.js'

/**
 * Request headers are logged from an allowlist. Loki keeps logs past
 * credential rotation, and Cloudflare adds the client IP and geo headers
 * (`cf-connecting-ip`, `x-forwarded-for`, `cf-ipcountry` and others) to
 * every request, so a denylist leaks each new one.
 */
export const ACCESS_LOG_OPTIONS = {
	transports: [createConsoleTransport()],
	reqKeys: ['url', 'method', 'httpVersion', 'href', 'query', 'length'],
	reqSelect: [
		'header.host',
		'header.user-agent',
		'header.x-service-name',
		'header.x-request-id',
		'header.idempotency-key',
		'header.content-type',
		'header.content-length',
	],
	reqUnselect: [],
	resUnselect: ['header.set-cookie'],
}

/**
 * Sets up and configures the Koa application with all middleware and plugins
 */
export async function setupKoaApp(): Promise<Koa> {
	const app = new Koa()

	// Add request ID middleware before any other middleware
	app.use(createRequestIdMiddleware())

	app.use(logger(ACCESS_LOG_OPTIONS))

	// Internal harness readiness endpoint; mutation routes remain API-key protected.
	app.use(createHealthMiddleware())

	// Add API key authentication middleware
	app.use(createApiKeyAuthMiddleware())

	// Add standard middleware
	app.use(cors())
	app.use(bodyParser())

	// Setup Bull Board
	setupBullBoard(app)

	// Add error handling middleware
	app.use(createErrorHandler())

	app.use(pageNotFound)

	return app
}
