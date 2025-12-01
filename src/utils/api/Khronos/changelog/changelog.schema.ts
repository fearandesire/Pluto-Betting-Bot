import { z } from 'zod'

export const ChangelogResponseSchema = z.object({
	id: z.string(),
	app_name: z.enum(['Pluto', 'Khronos', 'Goracle']),
	version: z.string(),
	title: z.string(),
	content: z.string(),
	published_at: z.date(),
	created_at: z.date(),
	updated_at: z.date(),
})

export type ChangelogResponse = z.infer<typeof ChangelogResponseSchema>
