import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

export const REQUEST_ID_HEADER = 'X-Request-ID'

type RequestContext = {
	/**
	 * The run-correlation key. Inside a job that carries Khronos' id this is that id,
	 * so one value joins a cron run across services.
	 */
	readonly requestId: string
	/** The BullMQ job id, set only inside a job. */
	readonly jobId?: string
}

const storage = new AsyncLocalStorage<RequestContext>()

export const runWithRequestId = <T>(
	requestId: string,
	fn: () => T,
	jobId?: string,
): T => storage.run({ requestId, jobId }, fn)

export const currentRequestId = (): string | undefined =>
	storage.getStore()?.requestId

export const currentJobId = (): string | undefined => storage.getStore()?.jobId

/** Work outside any interaction, inbound request or job still gets an id Khronos can log. */
export const outboundRequestId = (): string =>
	currentRequestId() ?? randomUUID()

export const withRequestIdHeader = <I extends RequestInit>(init?: I): I => {
	const headers = new Headers(init?.headers)
	if (!headers.has(REQUEST_ID_HEADER)) {
		headers.set(REQUEST_ID_HEADER, outboundRequestId())
	}
	return { ...init, headers } as I
}

/** Reads the upstream run id off a job payload. Queues without one pass `undefined`. */
export type UpstreamRequestId<J> =
	| ((job: NonNullable<J>) => string | undefined)
	| undefined

const runInJob = <J extends { id?: string }, R>(
	job: J,
	jobId: string,
	upstreamRequestId: UpstreamRequestId<J>,
	fn: () => R,
): R => runWithRequestId(upstreamRequestId?.(job) ?? jobId, fn, jobId)

/** BullMQ processors run outside the request that enqueued them, so the job supplies the ids. */
export const withJobRequestId =
	<J extends { id?: string }, R>(
		process: (job: J) => Promise<R>,
		upstreamRequestId: UpstreamRequestId<NoInfer<J>>,
	) =>
	(job: J): Promise<R> =>
		runInJob(job, job.id ?? randomUUID(), upstreamRequestId, () =>
			process(job),
		)

/**
 * Worker `active`, `completed` and `failed` listeners run outside the processor, so
 * they restore the same ids. Pass the processor's extractor so both agree.
 */
export const withJobEventRequestId =
	<J extends { id?: string } | undefined, A extends unknown[], R>(
		listener: (job: J, ...rest: A) => R,
		upstreamRequestId: UpstreamRequestId<NoInfer<J>>,
	) =>
	(job: J, ...rest: A): R =>
		job?.id
			? runInJob(job as NonNullable<J>, job.id, upstreamRequestId, () =>
					listener(job, ...rest),
				)
			: listener(job, ...rest)
