import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../logging/WinstonLogger.js', () => ({
	logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

import { validateParlayResultNotification } from '../parlay-notification-utils.js'

const validLeg = {
	id: '00000000-0000-0000-0000-000000000001',
	event_id: 'event-1',
	outcome_uuid: 'outcome-1',
	market_key: 'h2h' as const,
	selection_display: 'Lakers',
	odds_american: -110,
	point: null,
	commence_time: '2026-07-11T20:00:00.000Z',
	result: 'won' as const,
}

const validPayload = {
	kind: 'won' as const,
	parlay_id: '11111111-1111-4111-8111-111111111110',
	user_id: 'user-1',
	stake: 10,
	combined_odds_american: 377,
	payout: 47.7,
	actual_payout: 47.7,
	old_balance: 100,
	new_balance: 137.7,
	legs: [validLeg, { ...validLeg, id: 'leg-2', event_id: 'event-2' }],
}

describe('validateParlayResultNotification', () => {
	it('accepts a strict won payload', () => {
		const result = validateParlayResultNotification(validPayload)
		expect(result).not.toBeNull()
		expect(result).toMatchObject({
			parlay_id: validPayload.parlay_id,
			kind: 'won',
		})
		expect(result?.legs[0].commence_time).toEqual(
			new Date(validLeg.commence_time),
		)
	})

	it('rejects malformed payloads', () => {
		expect(
			validateParlayResultNotification({
				...validPayload,
				parlay_id: 'not-a-uuid',
			}),
		).toBeNull()
		expect(
			validateParlayResultNotification({
				...validPayload,
				legs: [
					{
						...validLeg,
						commence_time: 'not-a-date',
					},
				],
			}),
		).toBeNull()
		expect(
			validateParlayResultNotification({
				...validPayload,
				legs: [],
			}),
		).toBeNull()
	})

	it('accepts a won payload without payout when actual_payout is null', () => {
		// The published @pluto-khronos/types contract does not require payout or
		// actual_payout for won notifications; the retired local shim did. The
		// published schema wins.
		const result = validateParlayResultNotification({
			...validPayload,
			payout: undefined,
			actual_payout: null,
		})
		expect(result).not.toBeNull()
		expect(result?.kind).toBe('won')
	})
})
