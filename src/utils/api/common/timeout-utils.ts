/**
 * Utility function to wrap a promise with a timeout
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that rejects with timeout error if timeout is exceeded
 */
export function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
): Promise<T> {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) =>
			setTimeout(
				() => reject(new Error(`Request timeout after ${timeoutMs}ms`)),
				timeoutMs,
			),
		),
	])
}
