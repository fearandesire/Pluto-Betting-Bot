import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter' // .js added as a fix per: https://github.com/felixmosh/bull-board/issues/881
import { KoaAdapter } from '@bull-board/koa'
import type Application from 'koa'
import auth from 'koa-basic-auth'
import env from '../../../../lib/startup/env.js'
import { channelCreationQueue } from '../../../cache/queue/ChannelCreationQueue.js'
import { channelDeletionQueue } from '../../../cache/queue/ChannelDeletionQueue.js'

/**
 * Sets up Bull Board with the application
 * @param app The Koa application instance
 */
export function setupBullBoard(app: Application) {
	const serverAdapter = new KoaAdapter()
	serverAdapter.setBasePath('/api/pluto/admin/queues')

	// Create the Bull Board instance
	createBullBoard({
		queues: [
			new BullMQAdapter(channelCreationQueue.queue),
			new BullMQAdapter(channelDeletionQueue.queue),
		],
		serverAdapter,
	})

	// Add authentication middleware for Bull Board routes
	app.use(async (ctx, next) => {
		if (!ctx.path.startsWith('/api/pluto/admin/queues')) {
			return next()
		}

		await auth({
			name: env.BULL_BOARD_USERNAME,
			pass: env.BULL_BOARD_PASSWORD,
		})(ctx, next)
	})

	app.use(serverAdapter.registerPlugin())
}
