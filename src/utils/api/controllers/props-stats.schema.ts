import { z } from 'zod'

/**
 * The goal of the compilation of methods in this class is to achieve an object
 * of formatted embeds data that are ready to send to the guilds.
 *
 * The formatted embeds should follow something along the lines of:
 * Title: 'Accuracy Challenge Stats'
 * Description: '## away team vs. home team'
 * Fields:
 * - Over: percentages.over
 * - Under: percentages.under
 *
 * If the market key is 'h2h', then the fields in 'percentages' will be the home and away team.
 * So we will anonymously handle it, regardless of what the field name is.
 */
const _h2HPercentagesSchema = z
	.object({
		home: z
			.number()
			.min(0, 'Home team win percentage must be at least 0')
			.max(100, 'Home team win percentage cannot exceed 100')
			.int('Home team win percentage must be a whole number')
			.describe('Home team win percentage (0-100)'),
		away: z
			.number()
			.min(0, 'Away team win percentage must be at least 0')
			.max(100, 'Away team win percentage cannot exceed 100')
			.int('Away team win percentage must be a whole number')
			.describe('Away team win percentage (0-100)'),
	})
	.strict()
	.describe('Head-to-head percentage distribution between teams (0-100)')

const _overUnderPercentagesSchema = z
	.object({
		over: z
			.number()
			.min(0, 'Over percentage must be at least 0')
			.max(100, 'Over percentage cannot exceed 100')
			.int('Over percentage must be a whole number')
			.describe('Percentage of over predictions (0-100)'),
		under: z
			.number()
			.min(0, 'Under percentage must be at least 0')
			.max(100, 'Under percentage cannot exceed 100')
			.int('Under percentage must be a whole number')
			.describe('Percentage of under predictions (0-100)'),
	})
	.strict()
	.describe('Over/under percentage distribution for totals markets (0-100)')
