import { randomUUID } from 'node:crypto'
import redisCache, {
	type RedisCacheClient,
} from '../../cache/redis-instance.js'
import {
	ChannelCreationBusyError,
	LeaseLostError,
} from './ChannelCreationWorkflow.js'
export interface PresentationLock {
	run<T>(
		key: string,
		action: (check: () => Promise<void>) => Promise<T>,
	): Promise<T>
}

export class RedisPresentationLock implements PresentationLock {
	constructor(
		private readonly redis: Pick<
			RedisCacheClient,
			'set' | 'refreshIfOwned' | 'compareAndRemove'
		> = redisCache,
	) {}
	async run<T>(
		key: string,
		action: (check: () => Promise<void>) => Promise<T>,
	): Promise<T> {
		const lockKey = `pluto:channel-presentation:v1:${key}`
		const owner = randomUUID()
		if ((await this.redis.set(lockKey, owner, 'EX', 300, 'NX')) !== 'OK')
			throw new ChannelCreationBusyError()
		let lost = false
		const check = async () => {
			if (lost) throw new LeaseLostError()
			try {
				if (!(await this.redis.refreshIfOwned(lockKey, owner, 300)))
					lost = true
			} catch {
				lost = true
			}
			if (lost) throw new LeaseLostError()
		}
		const timer = setInterval(() => {
			void check().catch(() => {
				lost = true
			})
		}, 60_000)
		timer.unref?.()
		try {
			return await action(check)
		} finally {
			clearInterval(timer)
			await this.redis.compareAndRemove(lockKey, owner)
		}
	}
}
