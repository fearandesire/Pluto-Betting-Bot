// ============================================================================
// Autocomplete Formatter - Converts props to Discord autocomplete format
// ============================================================================

import StringUtils from '../common/string-utils.js';
import type { CachedProp } from './PropCacheService.js';

/**
 * Discord autocomplete choice format
 */
export interface AutocompleteChoice {
	name: string;
	value: string;
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
		const parts: string[] = [];

		// Add player/description if available
		if (prop.description) {
			parts.push(prop.description);
		}

		// Add market type
		const market = StringUtils.toTitleCase(
			prop.market_key.replace(/_/g, ' '),
		);
		parts.push(market);

		// Add line/point if available
		if (prop.point !== null && prop.point !== undefined) {
			parts.push(`${prop.point}`);
		}

		// Add matchup (abbreviated if needed)
		const matchup = `${prop.home_team} v ${prop.away_team}`;
		parts.push(matchup);

		const fullName = parts.join(' • ');

		// Truncate if too long
		if (fullName.length > 100) {
			return `${fullName.substring(0, 97)}...`;
		}

		return fullName;
	}

	/**
	 * Convert props to autocomplete choices
	 */
	static toAutocompleteChoices(props: CachedProp[]): AutocompleteChoice[] {
		return props.map((prop) => ({
			name: this.formatPropName(prop),
			value: prop.outcome_uuid,
		}));
	}

	/**
	 * Filter props by search query
	 * Searches across outcome_uuid, description, teams, and market
	 */
	static filterByQuery(props: CachedProp[], query: string): CachedProp[] {
		if (!query) return props;

		const lowerQuery = query.toLowerCase();

		return props.filter((prop) => {
			// Search in outcome_uuid
			if (prop.outcome_uuid.toLowerCase().includes(lowerQuery)) {
				return true;
			}

			// Search in description/player
			if (prop.description?.toLowerCase().includes(lowerQuery)) {
				return true;
			}

			// Search in teams
			if (
				prop.home_team.toLowerCase().includes(lowerQuery) ||
				prop.away_team.toLowerCase().includes(lowerQuery)
			) {
				return true;
			}

			// Search in market
			if (prop.market_key.toLowerCase().includes(lowerQuery)) {
				return true;
			}

			return false;
		});
	}
}

