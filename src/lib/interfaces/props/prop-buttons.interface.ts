export enum PropButtons {
	OVER = 'prop_btn_over',
	UNDER = 'prop_btn_under',
}

export interface ParsedPropButton {
	action: 'over' | 'under';
	propId: string;
}

/**
 * Identify the event / prop ID from the label of the button, additionally identifies the choice the user made
 *
 * @param customId - The custom ID string from the button interaction.
 * @returns An object containing the action ('over' or 'under') and the prop ID,
 *          or null if the custom ID doesn't match the expected format.
 *
 */
export function parsePropButtonId(customId: string): ParsedPropButton | null {
	for (const [key, value] of Object.entries(PropButtons)) {
		if (customId.startsWith(value)) {
			const action = key.toLowerCase() as 'over' | 'under';
			const propId = customId.slice(value.length + 1); // +1 to account for the underscore
			return { action, propId };
		}
	}
	return null;
}
