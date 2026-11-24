/** Commands that move money or read it. Their failures page ops. */
const BETTING_COMMANDS: ReadonlySet<string> = new Set([
	'bet',
	'parlay',
	'doubledown',
	'cancelbet',
	'odds',
	'dailyclaim',
])

/** Commands that place or cancel a bet, so a failure may leave a bet in an unknown state. */
const PLACEMENT_COMMANDS: ReadonlySet<string> = new Set([
	'bet',
	'parlay',
	'doubledown',
	'cancelbet',
])

export const isBettingCommand = (name: string): boolean =>
	BETTING_COMMANDS.has(name)

export const isPlacementCommand = (name: string): boolean =>
	PLACEMENT_COMMANDS.has(name)

/** Discord 10062: the interaction token expired before the bot acknowledged it. */
export const UNKNOWN_INTERACTION_CODE = 10062

export const isUnknownInteraction = (error: unknown): boolean =>
	typeof error === 'object' &&
	error !== null &&
	(error as { code?: unknown }).code === UNKNOWN_INTERACTION_CODE
