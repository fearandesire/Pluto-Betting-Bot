import cors from '@koa/cors';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { pageNotFound } from '../../requests/middleware.js';
import { createApiKeyAuthMiddleware } from './apiKeyAuth.js';
import { setupBullBoard } from './bullBoard.js';
import { createErrorHandler } from './errorHandler.js';
import { createLoggingMiddleware } from './logging.js';
import { createRequestIdMiddleware } from './requestId.js';

/**
 * Sets up and configures the Koa application with all middleware and plugins
 */
export async function setupKoaApp(): Promise<Koa> {
	const app = new Koa();

	// Add request ID middleware before any other middleware
	app.use(createRequestIdMiddleware());

	// Add logging middleware
	app.use(createLoggingMiddleware());

	// Add API key authentication middleware
	app.use(createApiKeyAuthMiddleware());

	// Add standard middleware
	app.use(cors());
	app.use(bodyParser());

	// Setup Bull Board
	setupBullBoard(app);

	// Add error handling middleware
	app.use(createErrorHandler());

	app.use(pageNotFound);

	return app;
}
