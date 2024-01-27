import logClr from '@pluto-internal-color-logger'
import { Cache } from '@pluto-redis'

/**
 * @function clearScheduled
 * Clears the cache of scheduled games
 */

export default async function clearScheduled() {
	await logClr({
		text: `Clearing scheduled games`,
		color: `yellow`,
		status: `processing`,
	})
	await Cache()
		.remove(`scheduled_games`)
		.then((res) => {
			if (res) {
				return logClr({
					text: `Cleared scheduled games`,
					color: `green`,
					status: `done`,
				})
			}
			return logClr({
				text: `Failed to clear scheduled games`,
				color: `red`,
				status: `error`,
			})
		})
}
