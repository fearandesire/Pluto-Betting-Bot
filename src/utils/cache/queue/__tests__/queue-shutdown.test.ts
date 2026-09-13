import { Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { describe, expect, it } from 'vitest'

const redisUrl = process.env.PLUTO_TEST_REDIS_URL
if (process.env.PLUTO_REQUIRE_REDIS_TESTS === '1' && !redisUrl) {
	throw new Error(
		'PLUTO_TEST_REDIS_URL is required when PLUTO_REQUIRE_REDIS_TESTS=1.',
	)
}

const describeWithRedis = redisUrl ? describe : describe.skip

describeWithRedis('BullMQ lock recovery', () => {
	it('reclaims a force-closed active job after its lock expires', async () => {
		const queueName = `shutdown-recovery-${Date.now()}`
		const connection = redisConnection(redisUrl!)
		const queue = new Queue(queueName, { connection })
		let firstWorker: Worker | undefined
		let secondWorker: Worker | undefined
		let releaseFirstJob!: () => void
		const firstJobCanFinish = new Promise<void>((resolve) => {
			releaseFirstJob = resolve
		})
		let markFirstJobActive!: () => void
		const firstJobIsActive = new Promise<void>((resolve) => {
			markFirstJobActive = resolve
		})
		let markRecovered!: (jobId: string) => void
		const recoveredJob = new Promise<string>((resolve) => {
			markRecovered = resolve
		})

		try {
			await queue.add('recoverable', { value: 'work' })
			firstWorker = new Worker(
				queueName,
				async () => {
					markFirstJobActive()
					await firstJobCanFinish
					return 'first worker'
				},
				{ connection, lockDuration: 100, stalledInterval: 50 },
			)
			await firstJobIsActive
			await firstWorker.close(true)

			secondWorker = new Worker(
				queueName,
				async (job) => {
					markRecovered(job.id ?? '')
					return 'recovered worker'
				},
				{ connection, lockDuration: 100, stalledInterval: 50 },
			)

			await expect(
				Promise.race([
					recoveredJob,
					new Promise<never>((_, reject) =>
						setTimeout(
							() => reject(new Error('job was not recovered')),
							2_000,
						),
					),
				]),
			).resolves.toBeTruthy()
		} finally {
			releaseFirstJob()
			await firstWorker?.close(true)
			await secondWorker?.close(true)
			await queue.obliterate({ force: true })
			await queue.close()
		}
	})
})

function redisConnection(url: string) {
	const parsed = new URL(url)
	return {
		host: parsed.hostname,
		port: Number(parsed.port || 6379),
		db: parsed.pathname ? Number(parsed.pathname.slice(1) || 0) : 0,
		username: parsed.username || undefined,
		password: parsed.password || undefined,
		maxRetriesPerRequest: null,
	}
}
