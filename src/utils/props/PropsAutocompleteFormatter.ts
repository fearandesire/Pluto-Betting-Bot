// ============================================================================
// Autocomplete Formatter - Converts props to Discord autocomplete format
// ============================================================================

import StringUtils from '../common/string-utils.js'
import { isValidUUID } from '../common/uuid-validation.js'
import { logger } from '../logging/WinstonLogger.js'
import type { CachedProp } from './PropCacheService.js'

/**
 * Discord autocomplete choice format
 */
export interface AutocompleteChoice {
	name: string
	value: string
}

/**
 * Formats cached props for Discord autocomplete
 * Handles truncation, filtering, and readable formatting
 */
export class PropsAutocompleteFormatter {
	/**
	 * Format a prop into a readable autocomplete string
	 * Max length: 100 chars (Discord limit)
	 */
	static formatPropName(prop: CachedProp): string {
		const parts: string[] = []

		// Add player/description if available
		if (prop.description) {
			parts.push(prop.description)
		}

		// Add market type
		const market = StringUtils.toTitleCase(
			prop.market_key.replace(/_/g, ' '),
		)
		parts.push(market)

		// Add line/point if available
		if (prop.point !== null && prop.point !== undefined) {
			parts.push(`${prop.point}`)
		}

		// Add matchup (abbreviated if needed)
		const matchup = `${prop.home_team} v ${prop.away_team}`
		parts.push(matchup)

		const fullName = parts.join(' • ')

		// Truncate if too long
		if (fullName.length > 100) {
			return `${fullName.substring(0, 97)}...`
		}

		return fullName
	}

	/**
	 * Convert props to autocomplete choices
	 * Validates that outcome_uuid is a valid UUID format before using as value
	 */
	static toAutocompleteChoices(props: CachedProp[]): AutocompleteChoice[] {
		const choices: AutocompleteChoice[] = []
		const invalidProps: Array<{ prop: CachedProp; outcome_uuid: string }> =
			[]

		for (const prop of props) {
			// Validate UUID format
			if (!isValidUUID(prop.outcome_uuid)) {
				invalidProps.push({
					prop,
					outcome_uuid: prop.outcome_uuid,
				})
				logger.warn('Invalid UUID format in cached prop', {
					outcome_uuid: prop.outcome_uuid,
					outcome_uuid_type: typeof prop.outcome_uuid,
					outcome_uuid_length: prop.outcome_uuid?.length,
					description: prop.description,
					market_key: prop.market_key,
					market_id: prop.market_id,
					formatted_name: this.formatPropName(prop),
					context: 'PropsAutocompleteFormatter.toAutocompleteChoices',
				})
				continue
			}

			const formattedName = this.formatPropName(prop)
			choices.push({
				name: formattedName,
				value: prop.outcome_uuid,
			})

			// Debug: Log transformation for first few props
			if (choices.length <= 3) {
				logger.debug('Prop to autocomplete choice transformation', {
					prop: {
						outcome_uuid: prop.outcome_uuid,
						description: prop.description,
						market_key: prop.market_key,
					},
					choice: {
						name: formattedName.substring(0, 50),
						value: prop.outcome_uuid,
					},
				})
			}
		}

		if (invalidProps.length > 0) {
			logger.error(
				'Props with invalid UUIDs filtered from autocomplete',
				{
					invalid_count: invalidProps.length,
					total_props: props.length,
					valid_choices_count: choices.length,
					invalid_props: invalidProps.map((p) => ({
						outcome_uuid: p.outcome_uuid,
						outcome_uuid_type: typeof p.outcome_uuid,
						outcome_uuid_length: p.outcome_uuid?.length,
						formatted_name: this.formatPropName(p.prop),
						description: p.prop.description,
						market_key: p.prop.market_key,
						market_id: p.prop.market_id,
					})),
					context: 'PropsAutocompleteFormatter.toAutocompleteChoices',
				},
			)
		}

		return choices
	}

	/**
	 * Filter props by search query
	 * Searches across outcome_uuid, description, teams, and market
	 */
	static filterByQuery(props: CachedProp[], query: string): CachedProp[] {
		if (!query) return props

		const lowerQuery = query.toLowerCase()

		return props.filter((prop) => {
			// Search in outcome_uuid
			if (prop.outcome_uuid.toLowerCase().includes(lowerQuery)) {
				return true
			}

			// Search in description/player
			if (prop.description?.toLowerCase().includes(lowerQuery)) {
				return true
			}

			// Search in teams
			if (
				prop.home_team.toLowerCase().includes(lowerQuery) ||
				prop.away_team.toLowerCase().includes(lowerQuery)
			) {
				return true
			}

			// Search in market
			if (prop.market_key.toLowerCase().includes(lowerQuery)) {
				return true
			}

			return false
		})
	}
}
