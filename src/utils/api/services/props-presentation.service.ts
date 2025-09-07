import { SapDiscClient } from '../../../index.js';
import { DateManager } from '../../common/DateManager.js';
import PropEmbedManager from '../../guilds/prop-embeds/PropEmbedManager.js';
import { logger } from '../../logging/WinstonLogger.js';
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
	 * Filters props based on a guild's preferred teams.
	 * @param {PropZod[]} props - Array of props to filter.
	 * @param {string | undefined} preferredTeams - Comma-separated string of preferred teams, or undefined.
	 * @returns {PropZod[]} Filtered array of props.
	 */
	private filterPropsByPreferredTeams(
		props: PropZod[],
		preferredTeams?: string,
	): PropZod[] {
		// If no preferred teams, return all props
		if (!preferredTeams) {
			return props;
		}

		const preferredTeamsArray = preferredTeams
			.split(',')
			.map((team) => team.trim());

		// Return props that have either home_team or away_team in preferred teams
		return props.filter((prop) =>
			preferredTeamsArray.some(
				(team) =>
					prop.home_team.toLowerCase().includes(team.toLowerCase()) ||
					prop.away_team.toLowerCase().includes(team.toLowerCase()),
			),
		);
	}

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
		await logger.info('Props filtered by date range', {
			propsWithinDateRangeLength: propsWithinDateRange?.length || 0,
			source: this.processAndCreateEmbeds.name,
		});

		const uniqueProps = this.selectRandomPropPerEvent(propsWithinDateRange);
		await logger.info('Unique props selected', {
			uniquePropsLength: uniqueProps?.length || 0,
			source: this.processAndCreateEmbeds.name,
		});

		const embedManager = new PropEmbedManager(SapDiscClient);

		// Group props by guild based on preferred teams
		const guildProps = new Map<string, PropZod[]>();

		for (const channel of guildChannels) {
			const filteredProps = this.filterPropsByPreferredTeams(
				uniqueProps,
				channel.preferred_teams,
			);
			guildProps.set(channel.guild_id, filteredProps);

			await logger.info('Props filtered by preferred teams for guild', {
				guildId: channel.guild_id,
				preferredTeams: channel.preferred_teams,
				filteredPropsLength: filteredProps.length,
				source: this.processAndCreateEmbeds.name,
			});
		}

		// Create embeds for each guild with their filtered props
		for (const channel of guildChannels) {
			const guildFilteredProps = guildProps.get(channel.guild_id) || [];
			await embedManager.createEmbeds(guildFilteredProps, [channel]);
		}
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
		const filteredProps = props.filter((prop) => {
			// Only filter out market keys for NFL props
			if (prop.sport_title?.toLowerCase() === 'nfl') {
				return !marketKeysToFilter.includes(prop.market_key);
			}
			// Keep all props from other sports
			return true;
		});

		if (filteredProps.length === 0) {
			return [];
		}

		return filteredProps;
	}
}
