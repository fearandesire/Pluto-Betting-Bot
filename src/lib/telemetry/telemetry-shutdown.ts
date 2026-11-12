export const TELEMETRY_FLUSH_TIMEOUT_MS = 5_000

let flush: (() => Promise<void>) | undefined

/** The SDK registers here so the app's shutdown can flush it without importing OpenTelemetry. */
export function registerTelemetryFlush(fn: () => Promise<void>): void {
	flush = fn
}

/** Resolves once buffered spans are exported or `timeoutMs` passes; never rejects. */
export async function flushTelemetry(
	timeoutMs = TELEMETRY_FLUSH_TIMEOUT_MS,
): Promise<void> {
	if (!flush) return
	let timer: ReturnType<typeof setTimeout> | undefined
	const timeout = new Promise<void>((resolve) => {
		timer = setTimeout(resolve, timeoutMs)
		timer.unref()
	})
	try {
		await Promise.race([flush().catch(() => undefined), timeout])
	} finally {
		clearTimeout(timer)
	}
}
