import { SapDiscClient } from '../../../index.js';
import { DateManager } from '../../common/DateManager.js';
import PropEmbedManager from '../../guilds/prop-embeds/PropEmbedManager.js';
import {
	type PropOptions,
	PropOptionsSchema,
	type PropZod,
} from '../common/interfaces/index.js';

/**
 * Service for processing and managing props.
 */
export class PropsPresentation {
	private defaultFilteredMarketKeys = ['totals', 'h2h'];
	private defaultOptions = {
		daysAhead: 7,
	};

	/**
	 * Initializes a new instance of the PropsService class.
	 */

	/**
	 * Processes props and creates embeds for the specified guild channels.
	 * @param {PropZod[]} props - Array of props to process.
	 * @param {Object[]} guildChannels - Array of guild and channel objects.
	 * @param {PropOptions} options - Options for processing props.
	 * @returns {Promise<void>}
	 */
	public async processAndCreateEmbeds(
		props: PropZod[],
		guildChannels,
		options: PropOptions = {},
	): Promise<void> {
		// Validate options
		const validatedOptions = PropOptionsSchema.parse(options);
		const daysAhead =
			validatedOptions.daysAhead ?? this.defaultOptions.daysAhead;

		const dateManager = new DateManager<PropZod>(daysAhead);
		const propsWithinDateRange = dateManager.filterByDateRange(props);

		const uniqueProps = this.selectRandomPropPerEvent(propsWithinDateRange);

		const embedManager = new PropEmbedManager(SapDiscClient);
		await embedManager.createEmbeds(uniqueProps, guildChannels);
	}

	/**
	 * @summary Selects a random prop per event from the given props.
	 * @description Iterates through the props we received, groups them by event ID and selects one prop at random.
	 * This is used to limit the number of props we send - and effectively limit it to 1 prop per event / match
	 * @param {PropZod[]} props - Array of props to select from.
	 * @returns {PropZod[]} Array of unique props, one per event.
	 */
	private selectRandomPropPerEvent(props: PropZod[]): PropZod[] {
		const eventMap = new Map<string, PropZod[]>();

		// Group props by event_id
		for (const prop of props) {
			if (!prop.event_id) continue;
			if (!eventMap.has(prop.event_id)) {
				eventMap.set(prop.event_id, []);
			}
			eventMap.get(prop.event_id)?.push(prop);
		}

		// Randomly select one prop per event
		return Array.from(eventMap.values()).map(
			(eventProps) => eventProps[Math.floor(Math.random() * eventProps.length)],
		);
	}

	/**
	 * Filters out props via multiple market keys.
	 * @param {PropZod[]} props - Array of props to filter.
	 * @param {string[]} marketKeysToFilter - Array of market keys to filter out.
	 * @returns {PropZod[]} Array of props without the specified market keys.
	 */
	public async filterPropsByMarketKeys(
		props: PropZod[],
		marketKeysToFilter: string[] = this.defaultFilteredMarketKeys,
	): Promise<PropZod[]> {
		const filteredProps = props.filter(
			(prop) => !marketKeysToFilter.includes(prop.market_key),
		);

		if (filteredProps.length === 0) {
			return [];
		}

		return filteredProps;
	}
}
