import { describe, expect, it } from 'vitest'
import BettingValidation from './betting-validation.js'

describe('BettingValidation', () => {
	describe('validateAmount', () => {
		it('returns true when amount is positive', () => {
			const validator = new BettingValidation()
			expect(validator.validateAmount(1)).toBe(true)
			expect(validator.validateAmount(100)).toBe(true)
		})

		it('returns false when amount is zero', () => {
			const validator = new BettingValidation()
			expect(validator.validateAmount(0)).toBe(false)
		})

		it('returns false when amount is negative', () => {
			const validator = new BettingValidation()
			expect(validator.validateAmount(-1)).toBe(false)
		})
	})
})
