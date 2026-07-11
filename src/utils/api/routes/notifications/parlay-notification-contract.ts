import { z } from 'zod'

/**
 * Temporary compatibility contract for TF-967.
 *
 * @pluto-khronos/types@3.4.3 does not export the C5 parlay notification
 * schema yet. Keep this shape aligned with TF-949's
 * `parlayResultNotificationSchema`; replace this module import with the
 * published package export when the paired Khronos release lands.
 */
export const parlayResultNotificationSchema = z
	.object({
		kind: z.enum(['won', 'lost', 'push_refunded', 'busted']),
		parlay_id: z.string().uuid(),
		user_id: z.string().min(1),
		guild_id: z.string().min(1).optional(),
		stake: z.number().finite().nonnegative(),
		combined_odds_american: z.number().int(),
		payout: z.number().finite().nonnegative().optional(),
		actual_payout: z.number().finite().nonnegative().nullable(),
		refund_amount: z.number().finite().nonnegative().optional(),
		old_balance: z.number().finite().optional(),
		new_balance: z.number().finite().optional(),
		legs: z
			.array(
				z.object({
					id: z.string().min(1),
					event_id: z.string().min(1),
					outcome_uuid: z.string().min(1),
					selection_display: z.string().min(1),
					market_key: z.string().min(1),
					odds_american: z.number().int(),
					point: z.number().finite().nullable(),
					commence_time: z.coerce.date(),
					result: z.enum(['pending', 'won', 'lost', 'push', 'void']),
					home_team: z.string().min(1).optional(),
					away_team: z.string().min(1).optional(),
				}),
			)
			.min(1),
	})
	.superRefine((payload, context) => {
		if (
			payload.kind === 'won' &&
			payload.actual_payout === null &&
			payload.payout === undefined
		) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['payout'],
				message: 'won notifications require payout or actual_payout',
			})
		}
	})

export type ParlayResultNotification = z.infer<
	typeof parlayResultNotificationSchema
>
