import { format } from 'date-fns'
import { z } from 'zod'

/**
 * Formats a Date to MM/DD/YY format
 */
export const formatDate = (date: Date): string => format(date, 'MM/dd/yy')

const dateField = (description: string) =>
	z
		.preprocess(
			(val) => (typeof val === 'string' ? new Date(val) : val),
			z.date(),
		)
		.describe(description)

export const ChangelogResponseSchema = z
	.object({
		id: z
			.string()
			.trim()
			.min(1)
			.describe('Unique changelog entry identifier'),
		app_name: z
			.enum(['Pluto', 'Khronos', 'Goracle'])
			.describe('Target application (Pluto, Khronos, or Goracle)'),
		version: z
			.string()
			.trim()
			.min(1)
			.describe('Release version (e.g., 1.0.0)'),
		title: z
			.string()
			.trim()
			.min(1)
			.describe('Short headline for the update'),
		content: z
			.string()
			.trim()
			.min(1)
			.describe('Full changelog body with update details'),
		published_at: dateField('Timestamp when the changelog was published'),
		created_at: dateField('Timestamp when the changelog was created'),
		updated_at: dateField('Timestamp when the changelog was last modified'),
	})
	.strict()
	.describe('Changelog entry from the Khronos API')

export type ChangelogResponse = z.infer<typeof ChangelogResponseSchema>
