// ============================================================================
// Autocomplete Interaction Handler - Sapphire.js listener
// ============================================================================

import { Events, Listener } from '@sapphire/framework';
import type { AutocompleteInteraction } from 'discord.js';
import PredictionApiWrapper from '../utils/api/Khronos/prediction/predictionApiWrapper.js';
import { CacheManager } from '../utils/cache/cache-manager.js';
import { ActivePropsService } from '../utils/props/ActivePropsService.js';
import { PropsCacheService } from '../utils/props/PropCacheService.js';
import { PropsAutocompleteFormatter } from '../utils/props/PropsAutocompleteFormatter.js';

/**
 * Handles autocomplete interactions for the props command
 * Provides real-time filtering of active props as the user types
 */
export class PropsAutocompleteListener extends Listener {
	private cacheService: PropsCacheService;
	private activePropsService: ActivePropsService;

	public constructor(
		context: Listener.LoaderContext,
		options: Listener.Options,
	) {
		super(context, {
			...options,
			event: Events.InteractionCreate,
		});

		// Initialize services
		const cacheManager = new CacheManager();
		this.cacheService = new PropsCacheService(cacheManager);
		const predictionApi = new PredictionApiWrapper();
		this.activePropsService = new ActivePropsService(
			predictionApi,
			this.cacheService,
		);
	}

	public async run(interaction: AutocompleteInteraction) {
		// Only handle autocomplete for props command
		if (!interaction.isAutocomplete()) return;
		if (interaction.commandName !== 'props') return;

		const subcommandGroup = interaction.options.getSubcommandGroup();
		const subcommand = interaction.options.getSubcommand();

		// Only handle setresult autocomplete
		if (subcommandGroup !== 'manage' || subcommand !== 'setresult') return;

		const focusedOption = interaction.options.getFocused(true);

		// Only handle prop_id autocomplete
		if (focusedOption.name !== 'prop_id') return;

		try {
			// Get active props (uses cache with fallback to API)
			const activeProps = await this.activePropsService.getActiveProps(
				interaction.guildId!,
				false, // Don't force refresh on every autocomplete
			);

			// Filter by user's current input
			const filtered = PropsAutocompleteFormatter.filterByQuery(
				activeProps,
				focusedOption.value as string,
			);

			// Convert to autocomplete choices (limit to 25 per Discord)
			const choices = PropsAutocompleteFormatter.toAutocompleteChoices(
				filtered.slice(0, 25),
			);

			await interaction.respond(choices);
		} catch (error) {
			this.container.logger.error('Props autocomplete error:', error);
			// Respond with empty array on error to avoid interaction timeout
			await interaction.respond([]);
		}
	}
}

