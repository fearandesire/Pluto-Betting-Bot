/**
 * @fileoverview Cache manager
 * Manage the cache of the application
 */

import NodeCache from 'node-cache'

export const cacheAdmn = new NodeCache()

export async function inCache(key) {
	const exists = await cacheAdmn.get(key)
	if (!exists) {
		await console.error(`Cache miss for key: ${key}`)
		return false
	}
	return exists
}
