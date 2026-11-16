import { PropsApi, ResponseError } from '@pluto-khronos/api-client'
import pTimeout from 'p-timeout'
import { KH_API_CONFIG } from '../KhronosInstances.js'

const DEFAULT_TIMEOUT_MS = 30_000

/** Selection strategies a server can pick for its daily props. */
export const PROP_STRATEGIES = ['default', 'smart'] as const
export type PropStrategy = (typeof PROP_STRATEGIES)[number]

/** A server's daily props settings row. */
export interface GuildPropSettings {
	guild_id: string
	strategy: PropStrategy
	enabled: boolean
	/** Daily post time as `HH:MM` UTC, or null for the default schedule. */
	post_time: string | null
}

interface GeneratedPropSettingsClient {
	getPropSettings(request: { guildId: string }): Promise<GuildPropSettings>
	updatePropSettings(request: {
		guildId: string
		updateGuildPropSettingsDto: { strategy?: PropStrategy }
	}): Promise<GuildPropSettings>
}

/**
 * Why a settings call failed, in terms a command can turn into plain copy.
 * `rejected` is a 400, `forbidden` a 401 or 403. `unconfirmed` means the
 * request may have reached Khronos (timeout or lost response), so the write
 * may still land.
 */
export type PropSettingsFailure =
	| 'rejected'
	| 'forbidden'
	| 'unavailable'
	| 'unconfirmed'

export class PropSettingsError extends Error {
	override readonly name = 'PropSettingsError'

	constructor(
		readonly reason: PropSettingsFailure,
		readonly status?: number,
	) {
		super(`Props settings request failed: ${reason}`)
	}
}

/** Failures after the request left Pluto: the write may still be applied. */
const MAYBE_SENT_ERRORS = new Set(['TimeoutError', 'FetchError'])

function toSettingsError(error: unknown): PropSettingsError {
	if (error instanceof ResponseError) {
		const { status } = error.response
		if (status === 400) return new PropSettingsError('rejected', status)
		if (status === 401 || status === 403) {
			return new PropSettingsError('forbidden', status)
		}
		return new PropSettingsError('unavailable', status)
	}
	if (error instanceof Error && MAYBE_SENT_ERRORS.has(error.name)) {
		return new PropSettingsError('unconfirmed')
	}
	return new PropSettingsError('unavailable')
}

/**
 * Reads and updates a server's daily props settings through the generated
 * `PropsApi`. The methods exist from the client release that publishes the
 * settings routes; until then a call fails as `unavailable`.
 */
export default class PropSettingsWrapper {
	private readonly api: GeneratedPropSettingsClient

	constructor(api?: GeneratedPropSettingsClient) {
		this.api =
			api ??
			(new PropsApi(
				KH_API_CONFIG,
			) as unknown as GeneratedPropSettingsClient)
	}

	/** Returns null when the server has no settings row yet. */
	async get(guildId: string): Promise<GuildPropSettings | null> {
		try {
			return await this.call(() => this.api.getPropSettings({ guildId }))
		} catch (error) {
			if (error instanceof PropSettingsError && error.status === 404) {
				return null
			}
			throw error
		}
	}

	async setStrategy(
		guildId: string,
		strategy: PropStrategy,
	): Promise<GuildPropSettings> {
		return this.call(() =>
			this.api.updatePropSettings({
				guildId,
				updateGuildPropSettingsDto: { strategy },
			}),
		)
	}

	private async call<T>(request: () => Promise<T>): Promise<T> {
		try {
			return await pTimeout(request(), {
				milliseconds: DEFAULT_TIMEOUT_MS,
			})
		} catch (error) {
			throw toSettingsError(error)
		}
	}
}
