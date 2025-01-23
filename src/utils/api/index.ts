/**
 * @module ApiIndex
 * @description This module is the main entry & setup point for the Pluto API. This REST API is used for receiving data to trigger interactions with the application
 *
 */

import cors from '@koa/cors';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import logger from 'koa-logger';
import { v4 as uuidv4 } from 'uuid';
import {
	createMessageBuilder,
	fromError,
	isZodErrorLike,
} from 'zod-validation-error';
import { WinstonLogger } from '../logging/WinstonLogger.js';
import { pageNotFound } from './requests/middleware.js';
import { matchCache } from './routes/cache/match-cache.js';
import ChannelsRoutes from './routes/channels/channels-router.js';
import NotificationRouter from './routes/notifications/notifications.controller.js';
import PropsRouter from './routes/props/props-router.js';
import ScheduleRouter from './routes/schedule/schedule.js';

const customMsgBuilder = createMessageBuilder({
	includePath: true,
});

// Type guard for error object
interface HttpError extends Error {
	status?: number;
	statusCode?: number;
}

/**
 * Handles Zod validation errors by logging them and returning a formatted error response
 * @param err The error to process
 * @param ctx The Koa context
 * @param path The request path
 * @param method The request method
 * @returns A formatted error response object
 */
async function handleZodError(
	err: unknown,
	ctx: Koa.Context,
	path: string,
	method: string,
) {
	const zodError = await fromError(err, {
		messageBuilder: customMsgBuilder,
	});
	WinstonLogger.error('Validation Error', {
		error: {
			message: zodError.message,
			type: 'VALIDATION_ERROR',
		},
		context: 'http',
		path,
		method,
		reqId: ctx.state.reqId,
	});

	ctx.status = 400;
	return {
		status: 'error',
		code: 'VALIDATION_ERROR',
		message: zodError.message,
	};
}

const app = new Koa();

// Add request ID middleware before any other middleware
app.use(async (ctx, next) => {
	// Check for existing request ID in common header variations
	const existingRequestId =
		ctx.get('X-Request-ID') ||
		ctx.get('Request-ID') ||
		ctx.get('reqId') ||
		ctx.get('x-request-id'); // lowercase variant

	// Use existing request ID if present, otherwise generate new UUID
	ctx.state.reqId = existingRequestId || uuidv4();

	// Always set/forward the X-Request-ID header as reqId
	ctx.set('reqId', ctx.state.reqId);
	await next();
});

app.use(
	logger((str, args: any[]) => {
		// Extract the meaningful parts from args array
		const [, method = '', path = '', status = '', time = ''] = args;
		const duration = typeof time === 'number' ? time : 0;
		const statusCode = Number.parseInt(status);
		const logData = {
			context: 'http',
			method,
			path,
			...(status && { status }),
			duration,
			reqId: str.includes('-->')
				? args[4]?.state?.reqId
				: args[3]?.state?.reqId,
		};

		// Use info for 2xx status codes, error for others
		if ((statusCode >= 200 && statusCode < 300) || !statusCode) {
			WinstonLogger.info(`${method} ${path} ${status} ${duration}ms`, logData);
		} else {
			WinstonLogger.error(`${method} ${path} ${status} ${duration}ms`, logData);
		}
	}),
);
app.use(cors());
app.use(bodyParser());
app.use(pageNotFound);
// Error Handling Middleware
app.use(async (ctx, next) => {
	try {
		await next();
	} catch (err: unknown) {
		// Handle Zod validation errors
		if (isZodErrorLike(err)) {
			ctx.body = await handleZodError(err, ctx, ctx.path, ctx.method);
			return;
		}

		// Handle HTTP errors
		const isHttpError = (error: unknown): error is HttpError => {
			return error instanceof Error;
		};

		if (isHttpError(err)) {
			ctx.status = err.statusCode || err.status || 500;
			ctx.body = {
				status: 'error',
				code: ctx.status === 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR',
				message: err.message || 'An error occurred processing your request',
			};
			return;
		}

		// Handle unknown errors
		ctx.status = 500;
		ctx.body = {
			status: 'error',
			code: 'UNKNOWN_ERROR',
			message: 'An unexpected error occurred',
		};
	}
});

app.use(ChannelsRoutes.routes()).use(ChannelsRoutes.allowedMethods());
app.use(NotificationRouter.routes()).use(NotificationRouter.allowedMethods());
app.use(matchCache.routes()).use(matchCache.allowedMethods());
app.use(ScheduleRouter.routes()).use(ScheduleRouter.allowedMethods());
app.use(PropsRouter.routes()).use(PropsRouter.allowedMethods());
const { apiPort, apiURL } = process.env;

app.listen(apiPort, async () => {
	WinstonLogger.info(`API running at ${apiURL}:${apiPort}/`);
});

export { app };
