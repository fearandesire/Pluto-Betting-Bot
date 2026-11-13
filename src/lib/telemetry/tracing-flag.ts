/** Read from `process.env` directly: the preload runs before `env.ts` is parsed. */
export const isTracingEnabled = (): boolean =>
	process.env.PLUTO_OTEL_ENABLED === 'true'
