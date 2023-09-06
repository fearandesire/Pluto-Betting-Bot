import Cache from '#rCache'
import logClr from '#colorConsole'

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
	const clear = await Cache()
		.remove(`scheduledIds`)
		.then((res) => {
			if (res) {
				return true
			}
			return false
		})
	await logClr({
		text: `Cleared scheduled games`,
		color: `green`,
		status: `done`,
	})
	return clear
}
