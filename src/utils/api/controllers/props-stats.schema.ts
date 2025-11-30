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
		home: z.number().describe('Home team win percentage'),
		away: z.number().describe('Away team win percentage'),
	})
	.strict()
	.describe('Head-to-head percentage distribution between teams')

const _overUnderPercentagesSchema = z
	.object({
		over: z.number().describe('Percentage of over predictions'),
		under: z.number().describe('Percentage of under predictions'),
	})
	.strict()
	.describe('Over/under percentage distribution for totals markets')
