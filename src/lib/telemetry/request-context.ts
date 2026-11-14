import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

export const REQUEST_ID_HEADER = 'X-Request-ID'

type RequestContext = {
	readonly requestId: string
	/** The id the upstream caller (Khronos cron or API) put on the job payload. */
	readonly upstreamRequestId?: string
}

const storage = new AsyncLocalStorage<RequestContext>()

export const runWithRequestId = <T>(
	requestId: string,
	fn: () => T,
	upstreamRequestId?: string,
): T => storage.run({ requestId, upstreamRequestId }, fn)

export const currentRequestId = (): string | undefined =>
	storage.getStore()?.requestId

export const currentUpstreamRequestId = (): string | undefined =>
	storage.getStore()?.upstreamRequestId

/**
 * Khronos-bound calls carry the upstream run id when the job has one, so one id joins a cron run across services.
 * Work outside any interaction, inbound request or job still gets an id Khronos can log.
 */
export const outboundRequestId = (): string =>
	currentUpstreamRequestId() ?? currentRequestId() ?? randomUUID()

export const withRequestIdHeader = <I extends RequestInit>(init?: I): I => {
	const headers = new Headers(init?.headers)
	if (!headers.has(REQUEST_ID_HEADER)) {
		headers.set(REQUEST_ID_HEADER, outboundRequestId())
	}
	return { ...init, headers } as I
}

type UpstreamRequestId<J> = (job: NoInfer<J>) => string | undefined

/** BullMQ processors run outside the request that enqueued them, so the job id is their request id. */
export const withJobRequestId =
	<J extends { id?: string }, R>(
		process: (job: J) => Promise<R>,
		upstreamRequestId?: UpstreamRequestId<J>,
	) =>
	(job: J): Promise<R> =>
		runWithRequestId(
			job.id ?? randomUUID(),
			() => process(job),
			upstreamRequestId?.(job),
		)

/** Worker `active`, `completed` and `failed` listeners run outside the processor, so they need the job id restored. */
export const withJobEventRequestId =
	<J extends { id?: string } | undefined, A extends unknown[], R>(
		listener: (job: J, ...rest: A) => R,
		upstreamRequestId?: (job: NonNullable<J>) => string | undefined,
	) =>
	(job: J, ...rest: A): R =>
		job?.id
			? runWithRequestId(
					job.id,
					() => listener(job, ...rest),
					upstreamRequestId?.(job as NonNullable<J>),
				)
			: listener(job, ...rest)
