import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

export const REQUEST_ID_HEADER = 'X-Request-ID'

type RequestContext = { readonly requestId: string }

const storage = new AsyncLocalStorage<RequestContext>()

export const runWithRequestId = <T>(requestId: string, fn: () => T): T =>
	storage.run({ requestId }, fn)

export const currentRequestId = (): string | undefined =>
	storage.getStore()?.requestId

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

/** BullMQ processors run outside the request that enqueued them, so the job id is their request id. */
export const withJobRequestId =
	<J extends { id?: string }, R>(process: (job: J) => Promise<R>) =>
	(job: J): Promise<R> =>
		runWithRequestId(job.id ?? randomUUID(), () => process(job))

/** Worker `active`, `completed` and `failed` listeners run outside the processor, so they need the job id restored. */
export const withJobEventRequestId =
	<J extends { id?: string } | undefined, A extends unknown[], R>(
		listener: (job: J, ...rest: A) => R,
	) =>
	(job: J, ...rest: A): R =>
		job?.id
			? runWithRequestId(job.id, () => listener(job, ...rest))
			: listener(job, ...rest)
