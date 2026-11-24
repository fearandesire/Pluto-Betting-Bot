import { describe, expect, it } from 'vitest'
import { betReference } from '../bet-reference.js'
import {
	isBettingCommand,
	isPlacementCommand,
	isUnknownInteraction,
} from '../betting-commands.js'

describe('betReference', () => {
	it('returns the last eight digits of the interaction id', () => {
		expect(betReference('1234567890123456789')).toBe('23456789')
	})
})

describe('betting command classification', () => {
	it('treats every betting command as a betting command', () => {
		for (const name of [
			'bet',
			'parlay',
			'doubledown',
			'cancelbet',
			'odds',
			'dailyclaim',
		]) {
			expect(isBettingCommand(name)).toBe(true)
		}
		expect(isBettingCommand('profile')).toBe(false)
	})

	it('marks only placing and cancelling commands as placement commands', () => {
		expect(isPlacementCommand('bet')).toBe(true)
		expect(isPlacementCommand('cancelbet')).toBe(true)
		expect(isPlacementCommand('odds')).toBe(false)
	})

	it('recognises Discord 10062 by code, and nothing else', () => {
		expect(isUnknownInteraction({ code: 10062 })).toBe(true)
		expect(isUnknownInteraction({ code: 50013 })).toBe(false)
		expect(isUnknownInteraction(new Error('boom'))).toBe(false)
		expect(isUnknownInteraction(undefined)).toBe(false)
	})
})
