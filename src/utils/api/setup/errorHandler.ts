import type { Context } from 'koa';
import {
	createMessageBuilder,
	fromError,
	isZodErrorLike,
} from 'zod-validation-error';
import { WinstonLogger } from '../../logging/WinstonLogger.js';

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
 */
async function handleZodError(
	err: unknown,
	ctx: Context,
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

/**
 * Creates and returns the error handling middleware
 */
export function createErrorHandler() {
	return async (ctx: Context, next: () => Promise<void>) => {
		try {
			await next();
		} catch (err: unknown) {
			if (isZodErrorLike(err)) {
				ctx.body = await handleZodError(err, ctx, ctx.path, ctx.method);
				return;
			}

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

			ctx.status = 500;
			ctx.body = {
				status: 'error',
				code: 'UNKNOWN_ERROR',
				message: 'An unexpected error occurred',
			};
		}
	};
}
