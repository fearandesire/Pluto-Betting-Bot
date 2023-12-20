import logClr from '@pluto-internal-color-logger'
import Cache from '@pluto-redis'

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
	const clearIds = await Cache()
		.remove(`scheduledIds`)
		.then((res) => {
			if (res) {
				return true
			}
			return false
		})

	await Cache().remove(`scheduled_games`)

	await logClr({
		text: `Cleared scheduled games`,
		color: `green`,
		status: `done`,
	})
	return clearIds
}
