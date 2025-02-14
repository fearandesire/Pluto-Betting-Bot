import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { KoaAdapter } from '@bull-board/koa';
import type Application from 'koa';
import auth from 'koa-basic-auth';
import env from '../../../../lib/startup/env.js';
import { channelCreationQueue } from '../../../cache/queue/ChannelCreationQueue.js';
import { AuthRateLimit } from './authRateLimit.js';

/**
 * Sets up Bull Board with the application
 * @param app The Koa application instance
 */
export function setupBullBoard(app: Application) {
	const serverAdapter = new KoaAdapter();
	serverAdapter.setBasePath('/admin/queues');

	// Create the Bull Board instance
	createBullBoard({
		queues: [new BullMQAdapter(channelCreationQueue.queue)],
		serverAdapter,
	});

	// Initialize rate limiter
	const rateLimiter = new AuthRateLimit();

	// Add rate limiting and authentication middleware for Bull Board routes
	app.use(async (ctx, next) => {
		if (!ctx.path.startsWith('/admin/queues')) {
			return next();
		}

		// Check for IP ban first
		const isBanned = await rateLimiter.isBanned(ctx.ip);
		if (isBanned) {
			ctx.status = 403;
			ctx.body = {
				error: 'Access restricted.',
			};
			return;
		}

		try {
			// Attempt authentication
			await auth({
				name: env.BULL_BOARD_USERNAME,
				pass: env.BULL_BOARD_PASSWORD,
			})(ctx, async () => {
				// If authentication succeeds, reset failed attempts and continue
				await rateLimiter.resetAttempts(ctx.ip);
				await next();
			});
		} catch (error) {
			// Record failed attempt and throw error
			await rateLimiter.recordFailedAttempt(ctx.ip);
			throw error;
		}
	});

	app.use(serverAdapter.registerPlugin());
}
