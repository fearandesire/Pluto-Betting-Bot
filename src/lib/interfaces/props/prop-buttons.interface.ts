export interface ParsedPropButton {
	action: string; // Can be a team name, 'OVER', or 'UNDER'
	propId: string; // UUID
}

/**
 * Identify the event / prop ID from the label of the button, additionally identifies the choice the user made
 *
 * @param customId - The custom ID string from the button interaction.
 * @returns An object containing the action (team name, 'OVER', or 'UNDER') and the prop ID,
 *          or null if the custom ID doesn't match the expected format.
 */
export function parsePropButtonId(customId: string): ParsedPropButton | null {
	if (!customId.startsWith('prop_')) {
		return null;
	}

	const parts = customId.slice(5).split('_'); // Remove 'prop_' prefix and split
	const propId = parts.pop()!; // Get prop ID at the end (uuid)
	const action = parts.join('_'); // Join the rest back together (in case team names contain underscores)

	return { action, propId };
}

// We can keep this enum for specific button types, but it's no longer used in parsing
export enum PropButtons {
	OVER = 'OVER',
	UNDER = 'UNDER',
}
