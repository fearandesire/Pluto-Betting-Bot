/**
 * The last eight digits of an interaction id: short enough to read back to a
 * user, and enough to find the full id in logs.
 */
export const betReference = (interactionId: string): string =>
	interactionId.slice(-8)
