import { PropOptions, PropOptionsSchema, PropZod } from "@pluto-api-interfaces";
import { DateManager } from "../../common/DateManager.js";
import PropEmbedManager from "../../guilds/prop-embeds/PropEmbedManager.js";

/**
 * Service for processing and managing props.
 */
export class PropsService {
	private embedManager: PropEmbedManager

	constructor() {
		this.embedManager = new PropEmbedManager()
	}

	/**
	 * Processes props and creates embeds for the specified guild channels.
	 * @param {PropZod[]} props - Array of props to process.
	 * @param {Object[]} guildChannels - Array of guild and channel objects.
	 * @param {number} daysAhead - Number of days ahead to filter props.
	 * @returns {Promise<void>}
	 */
	public async processAndCreateEmbeds(
		props: PropZod[],
		guildChannels: { guild_id: string; channel_id: string }[],
		options: PropOptions = {},
	): Promise<void> {
		// Validate options
		const validatedOptions = PropOptionsSchema.parse(options)

		const daysAhead = validatedOptions.daysAhead ?? 2 // Default to 2 if not provided

		const dateManager = new DateManager<PropZod>(daysAhead)
		const filteredProps = dateManager.filterByDateRange(props)
		const uniqueProps = this.filterUniqueProps(filteredProps)
		await this.embedManager.createEmbeds(uniqueProps, guildChannels)
	}

	/**
	 * Filters props to ensure only one prop per event is included.
	 * @param {PropZod[]} props - Array of props to filter.
	 * @returns {PropZod[]} Array of unique props.
	 */
	private filterUniqueProps(props: PropZod[]): PropZod[] {
		const eventMap = new Map<string, PropZod>()

		for (const prop of props) {
			if (
				!eventMap.has(prop.event_id) ||
				this.shouldReplaceProp(eventMap.get(prop.event_id)!, prop)
			) {
				eventMap.set(prop.event_id, prop)
			}
		}

		return Array.from(eventMap.values())
	}

	/**
	 * Determines if a new prop should replace an existing prop.
	 * @param {PropZod} existingProp - The existing prop for the event.
	 * @param {PropZod} newProp - The new prop being considered.
	 * @returns {boolean} True if the new prop should replace the existing one.
	 */
	private shouldReplaceProp(
		existingProp: PropZod,
		newProp: PropZod,
	): boolean {
		// If both have prices, prioritize the more recent update
		return (
			new Date(newProp.last_update) > new Date(existingProp.last_update)
		)
	}
}
