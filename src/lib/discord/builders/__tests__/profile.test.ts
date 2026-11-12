import { MessageFlags } from 'discord.js'
import { describe, expect, it } from 'vitest'
import {
	expectV2Payload,
	toJsonComponents,
} from '../../v2/__tests__/v2-assert.js'
import {
	decodeProfileShare,
	encodeProfileShare,
	profileCardPayload,
	profileSharedPayload,
	readProfileBadgeLine,
} from '../profile.js'

describe('profile share custom id', () => {
	const route = {
		ownerId: '111111111111111111',
		targetId: '22222222222222222',
	}

	it('round-trips and stays within the 100 char limit', () => {
		const id = encodeProfileShare(route)
		expect(id).toBe('profile.v1.share.111111111111111111.22222222222222222')
		expect(id.length).toBeLessThanOrEqual(100)
		expect(decodeProfileShare(id)).toEqual(route)
	})

	it('rejects non-snowflake ids on both sides', () => {
		expect(() =>
			encodeProfileShare({ ownerId: 'abc', targetId: route.targetId }),
		).toThrow()
		expect(decodeProfileShare('profile.v1.share.abc.123')).toBeNull()
	})
})

describe('profileCardPayload', () => {
	const route = {
		ownerId: '111111111111111111',
		targetId: '22222222222222222',
	}
	const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])
	const buttons = (payload: never) => {
		const [container] = toJsonComponents(payload) as unknown as Array<{
			components: Array<{ components?: Array<{ custom_id: string }> }>
		}>
		return container.components
			.slice(-1)[0]
			.components?.map((b) => b.custom_id)
	}

	it('adds the Achievements button from the route alone', () => {
		const payload = profileCardPayload({ png, route })
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 5,
		})
		expect(buttons(payload as never)).toEqual([
			'ach.v1.view.22222222222222222',
			'profile.v1.share.111111111111111111.22222222222222222',
		])
		const shared = profileCardPayload({ png, route, shared: true })
		expect(buttons(shared as never)?.[0]).toBe(
			'ach.v1.view.22222222222222222',
		)
	})

	it('adds one text line for the badge line', () => {
		const payload = profileCardPayload({
			png,
			route,
			badgeLine: 'Opening Score · 1 of 10 badges',
		})
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 6,
		})
	})

	it('round-trips the badge line through readProfileBadgeLine', () => {
		const payload = profileCardPayload({
			png,
			route,
			badgeLine: 'Opening Score · 1 of 10 badges',
		})
		expect(readProfileBadgeLine(payload)).toBe(
			'Opening Score · 1 of 10 badges',
		)
	})

	it('returns null for a card without a badge line', () => {
		expect(
			readProfileBadgeLine(profileCardPayload({ png, route })),
		).toBeNull()
		expect(readProfileBadgeLine({})).toBeNull()
	})
})

describe('profileSharedPayload', () => {
	const png = Buffer.from([0x89, 0x50, 0x4e, 0x47])

	it('is unchanged without a badge line', () => {
		const payload = profileSharedPayload(png, '111111111111111111')
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 3,
		})
	})

	it('places the badge line between the card and the sharer', () => {
		const payload = profileSharedPayload(png, '111111111111111111', 'Line')
		expectV2Payload(payload, {
			flags: MessageFlags.IsComponentsV2,
			components: 4,
		})
		const [container] = toJsonComponents(payload) as Array<{
			components: Array<{ content?: string }>
		}>
		expect(container.components.map((c) => c.content)).toEqual([
			undefined,
			'Line',
			'-# Shared by <@111111111111111111>',
		])
	})
})
