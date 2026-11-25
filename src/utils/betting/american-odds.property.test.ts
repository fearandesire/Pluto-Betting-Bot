import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
	americanToDecimal,
	combineAmericanOdds,
	decimalToAmerican,
} from './american-odds.js'

const settings = {
	numRuns: 200,
	seed: Number(process.env.VERIFY_SEED ?? 20261105),
}
const odds = fc
	.tuple(fc.integer({ min: 100, max: 10000 }), fc.boolean())
	.map(([value, negative]) => (negative ? -value : value))
describe('American odds properties', () => {
	it('round-trips legal integer prices and keeps decimal payout above stake', () => {
		fc.assert(
			fc.property(odds, (price) => {
				const decimal = americanToDecimal(price)
				expect(decimal).toBeGreaterThan(1)
				const restored = decimalToAmerican(decimal)
				// +100 and -100 are the same even-money price.
				expect(
					Math.abs(price) === 100 ? Math.abs(restored) : restored,
				).toBe(Math.abs(price) === 100 ? 100 : price)
			}),
			settings,
		)
	})
	it('a parlay is order independent and no less than any leg payout', () => {
		fc.assert(
			fc.property(
				fc.array(odds, { minLength: 1, maxLength: 6 }),
				(legs) => {
					const result = combineAmericanOdds(legs)
					expect(result.decimal).toBeGreaterThanOrEqual(
						Math.max(...legs.map(americanToDecimal)),
					)
					const reversed = combineAmericanOdds([...legs].reverse())
					expect(
						Math.abs(result.decimal - reversed.decimal),
					).toBeLessThanOrEqual(Number.EPSILON * 12 * result.decimal)
				},
			),
			settings,
		)
	})
	it('rejects invalid prices and empty parlays', () => {
		for (const invalid of [0, NaN, Infinity, -Infinity])
			expect(() => americanToDecimal(invalid)).toThrow()
		fc.assert(
			fc.property(
				fc.double({ min: -1e6, max: 1, noNaN: true }),
				(decimal) => {
					expect(() => decimalToAmerican(decimal)).toThrow()
				},
			),
			settings,
		)
		expect(() => combineAmericanOdds([])).toThrow()
	})
})
