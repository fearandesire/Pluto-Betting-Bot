import logger from 'koa-logger';
import { WinstonLogger } from '../../logging/WinstonLogger.js';

/**
 * Creates and returns the logging middleware
 * Ignores paths that start with /admin
 */
export function createLoggingMiddleware() {
	return logger((str, args: any[]) => {
		const [, method = '', path = '', status = '', time = ''] = args;

		// Skip logging for /admin paths
		if (path.startsWith('/admin')) {
			return;
		}

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

		if ((statusCode >= 200 && statusCode < 300) || !statusCode) {
			WinstonLogger.info(`${method} ${path} ${status} ${duration}ms`, logData);
		} else {
			WinstonLogger.error(`${method} ${path} ${status} ${duration}ms`, logData);
		}
	});
}
