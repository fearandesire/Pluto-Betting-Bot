import { PropOptions, PropOptionsSchema, PropZod } from '@pluto-api-interfaces'
import { DateManager } from '../../common/DateManager.js'
import PropEmbedManager from '../../guilds/prop-embeds/PropEmbedManager.js'
import { SapDiscClient } from '@pluto-core'

/**
 * Service for processing and managing props.
 */
export class PropsService {
	private defaultFilteredMarketKey: string = 'totals'

	/**
	 * Initializes a new instance of the PropsService class.
	 */
	constructor() {}

	/**
	 * Processes props and creates embeds for the specified guild channels.
	 * @param {PropZod[]} props - Array of props to process.
	 * @param {Object[]} guildChannels - Array of guild and channel objects.
	 * @param {PropOptions} options - Options for processing props.
	 * @returns {Promise<void>}
	 */
	public async processAndCreateEmbeds(
		props: PropZod[],
		guildChannels: { guild_id: string; channel_id: string }[],
		options: PropOptions = {},
	): Promise<void> {
		// Validate options
		const validatedOptions = PropOptionsSchema.parse(options)

		const daysAhead = validatedOptions.daysAhead ?? 2

		const dateManager = new DateManager<PropZod>(daysAhead)
		const propsWithinDateRange = dateManager.filterByDateRange(props)
		const propsMarketFiltered = this.filterPropsByMarketKey(
			propsWithinDateRange,
			this.defaultFilteredMarketKey,
		)
		const uniqueProps = this.selectRandomPropPerEvent(propsMarketFiltered)
		const embedManager = new PropEmbedManager(SapDiscClient)
		await embedManager.createEmbeds(uniqueProps, guildChannels)
	}

	/**
	 * Selects a random prop per event from the given props.
	 * @param {PropZod[]} props - Array of props to select from.
	 * @returns {PropZod[]} Array of unique props, one per event.
	 */
	private selectRandomPropPerEvent(props: PropZod[]): PropZod[] {
		const eventMap = new Map<string, PropZod[]>()

		// Group props by event_id
		for (const prop of props) {
			if (!eventMap.has(prop.event_id)) {
				eventMap.set(prop.event_id, [])
			}
			eventMap.get(prop.event_id)!.push(prop)
		}

		// Randomly select one prop per event
		return Array.from(eventMap.values()).map(
			(eventProps) =>
				eventProps[Math.floor(Math.random() * eventProps.length)],
		)
	}

	/**
	 * Filters out props with a specific market key.
	 * @param {PropZod[]} props - Array of props to filter.
	 * @param {string} marketKeyToFilter - Market key to filter out.
	 * @returns {PropZod[]} Array of props without the specified market key.
	 */
	private filterPropsByMarketKey(
		props: PropZod[],
		marketKeyToFilter: string = this.defaultFilteredMarketKey,
	): PropZod[] {
		return props.filter((prop) => prop.market_key !== marketKeyToFilter)
	}
}
