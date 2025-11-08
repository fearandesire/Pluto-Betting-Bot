// ============================================================================
// Autocomplete Interaction Handler - Sapphire.js listener
// ============================================================================

import { Events, Listener } from '@sapphire/framework'
import type { AutocompleteInteraction } from 'discord.js'
import PredictionApiWrapper from '../utils/api/Khronos/prediction/predictionApiWrapper.js'
import { CacheManager } from '../utils/cache/cache-manager.js'
import { ActivePropsService } from '../utils/props/ActivePropsService.js'
import { PropsCacheService } from '../utils/props/PropCacheService.js'
import { PropsAutocompleteFormatter } from '../utils/props/PropsAutocompleteFormatter.js'

/**
 * Handles autocomplete interactions for the props command
 * Provides real-time filtering of active props as the user types
 */
export class PropsAutocompleteListener extends Listener {
	private cacheService: PropsCacheService
	private activePropsService: ActivePropsService

	public constructor(
		context: Listener.LoaderContext,
		options: Listener.Options,
	) {
		super(context, {
			...options,
			event: Events.InteractionCreate,
		})

		// Initialize services
		const cacheManager = new CacheManager()
		this.cacheService = new PropsCacheService(cacheManager)
		const predictionApi = new PredictionApiWrapper()
		this.activePropsService = new ActivePropsService(
			predictionApi,
			this.cacheService,
		)
	}

	public async run(interaction: AutocompleteInteraction) {
		const startTime = Date.now()

		if (!interaction.isAutocomplete()) return

		// Check for admin command with props subcommand group
		if (interaction.commandName !== 'admin') return

		const subcommandGroup = interaction.options.getSubcommandGroup()
		const subcommand = interaction.options.getSubcommand()

		// Only handle props setresult autocomplete
		if (subcommandGroup !== 'props' || subcommand !== 'setresult') return

		const focusedOption = interaction.options.getFocused(true)

		// Only handle prop_id autocomplete
		if (focusedOption.name !== 'prop_id') return

		const guildId = interaction.guildId
		const query = (focusedOption.value as string) || ''

		if (!guildId) {
			this.container.logger.warn('Props autocomplete: missing guildId')
			await interaction.respond([])
			return
		}

		try {
			// Get active props (uses cache with fallback to API)
			const cacheStartTime = Date.now()
			const { props: activeProps, fromCache } =
				await this.activePropsService.getActiveProps(
					guildId,
					false, // Don't force refresh on every autocomplete
				)
			const cacheDuration = Date.now() - cacheStartTime

			// Debug: Log raw cached props structure before processing
			if (activeProps.length > 0) {
				this.container.logger.debug('Raw cached props sample', {
					guildId,
					fromCache,
					sampleProps: activeProps.slice(0, 2).map((p) => ({
						outcome_uuid: p.outcome_uuid,
						outcome_uuid_type: typeof p.outcome_uuid,
						outcome_uuid_length: p.outcome_uuid?.length,
						market_id: p.market_id,
						description: p.description,
						market_key: p.market_key,
					})),
					totalProps: activeProps.length,
				})
			}

			// Log cache performance
			this.container.logger.info(
				fromCache
					? 'Props autocomplete cache hit'
					: 'Props autocomplete cache miss',
				{
					guildId,
					propsCount: activeProps.length,
					cacheDuration: `${cacheDuration}ms`,
				},
			)

			// Filter by user's current input
			const filtered = PropsAutocompleteFormatter.filterByQuery(
				activeProps,
				query,
			)

			// Debug: Log filtering results
			this.container.logger.debug('Props filtering results', {
				guildId,
				query: query || '(empty)',
				totalProps: activeProps.length,
				filteredCount: filtered.length,
			})

			// Convert to autocomplete choices (limit to 25 per Discord)
			const choices = PropsAutocompleteFormatter.toAutocompleteChoices(
				filtered.slice(0, 25),
			)

			// Debug logging: Log sample choices to verify UUID format and transformation
			const sampleChoices = choices.slice(0, 3).map((choice, index) => {
				const originalProp = filtered[index]
				return {
					choiceIndex: index,
					name: choice.name.substring(0, 50),
					nameLength: choice.name.length,
					value: choice.value,
					valueLength: choice.value.length,
					valueType: typeof choice.value,
					isValidUUID: /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(
						choice.value,
					),
					originalOutcomeUuid: originalProp?.outcome_uuid,
					originalOutcomeUuidType: typeof originalProp?.outcome_uuid,
				}
			})

			const totalDuration = Date.now() - startTime
			this.container.logger.info('Props autocomplete response', {
				guildId,
				query: query || '(empty)',
				totalProps: activeProps.length,
				filteredCount: filtered.length,
				returnedCount: choices.length,
				totalDuration: `${totalDuration}ms`,
				sampleChoices,
			})

			// Validate all choices have valid UUIDs as values
			const invalidChoices = choices.filter(
				(choice) =>
					!/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(
						choice.value,
					),
			)

			if (invalidChoices.length > 0) {
				this.container.logger.error(
					'Invalid UUIDs detected in autocomplete choices',
					{
						guildId,
						invalidCount: invalidChoices.length,
						totalChoices: choices.length,
						invalidChoices: invalidChoices.map((c, idx) => {
							const originalProp = filtered[idx]
							return {
								name: c.name.substring(0, 50),
								value: c.value,
								valueType: typeof c.value,
								valueLength: c.value.length,
								originalOutcomeUuid: originalProp?.outcome_uuid,
								originalOutcomeUuidType: typeof originalProp?.outcome_uuid,
							}
						}),
						context: 'PropsAutocompleteListener.run',
					},
				)
			}

			await interaction.respond(choices)
		} catch (error) {
			const totalDuration = Date.now() - startTime
			this.container.logger.error('Props autocomplete error', {
				guildId,
				query,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
				totalDuration: `${totalDuration}ms`,
			})
			// Respond with empty array on error to avoid interaction timeout
			await interaction.respond([])
		}
	}
}
