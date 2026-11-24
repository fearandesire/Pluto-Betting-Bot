/**
 * The last eight digits of an interaction id: short enough to read back to a
 * user, and enough to find the full id in logs.
 */
export const betReference = (interactionId: string): string =>
	interactionId.slice(-8)

/**
 * Copy for a placement whose outcome is unknown. Every surface that reports a
 * failed placement uses this text, so the wording cannot drift between them.
 */
export const unconfirmedBetCopy = (interactionId: string) => ({
	title: 'Bet not confirmed',
	description: `We couldn't confirm your bet. Check /mybets before you try again.\nReference: \`${betReference(interactionId)}\``,
})
