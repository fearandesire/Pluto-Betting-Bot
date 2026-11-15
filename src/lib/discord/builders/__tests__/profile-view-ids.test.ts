import { describe, expect, it } from 'vitest'
import {
	decodeProfileViewAction,
	encodeProfileViewAction,
	type ProfileViewAction,
} from '../profile-view-ids.js'

const OWNER = '123456789012345678'
const TARGET = '22222222222222222'

const actions: ProfileViewAction[] = [
	{ kind: 'expand', ownerId: OWNER, targetId: TARGET, page: 0 },
	{ kind: 'expand', ownerId: OWNER, targetId: TARGET, page: 12 },
	{ kind: 'collapse', ownerId: OWNER, targetId: TARGET },
	{ kind: 'share', ownerId: OWNER, targetId: TARGET },
	{ kind: 'settings', ownerId: OWNER },
	{ kind: 'setview', ownerId: OWNER },
]

describe('profile view custom ids', () => {
	it.each(actions)(
		"round-trips %j within Discord's 100 characters",
		(action) => {
			const id = encodeProfileViewAction(action)
			expect(id.length).toBeLessThanOrEqual(100)
			expect(decodeProfileViewAction(id)).toEqual(action)
		},
	)

	it('writes a stable shape', () => {
		expect(encodeProfileViewAction(actions[0])).toBe(
			`profile.v2.expand.${OWNER}.${TARGET}.0`,
		)
		expect(
			encodeProfileViewAction({ kind: 'settings', ownerId: OWNER }),
		).toBe(`profile.v2.settings.${OWNER}`)
	})

	it('refuses to encode bad ids or pages', () => {
		expect(() =>
			encodeProfileViewAction({
				kind: 'share',
				ownerId: 'x',
				targetId: TARGET,
			}),
		).toThrow()
		expect(() =>
			encodeProfileViewAction({
				kind: 'expand',
				ownerId: OWNER,
				targetId: 'nope',
				page: 0,
			}),
		).toThrow()
		expect(() =>
			encodeProfileViewAction({
				kind: 'expand',
				ownerId: OWNER,
				targetId: TARGET,
				page: -1,
			}),
		).toThrow()
	})

	it.each([
		'profile.v1.share.123456789012345678.22222222222222222',
		'profile.v2.nope.123456789012345678.22222222222222222',
		`profile.v2.expand.${OWNER}.${TARGET}`,
		`profile.v2.expand.${OWNER}.${TARGET}.x`,
		`profile.v2.expand.${OWNER}.${TARGET}.0.extra`,
		`profile.v2.collapse.${OWNER}.${TARGET}.1`,
		`profile.v2.settings.${OWNER}.${TARGET}`,
		'profile.v2.settings.abc',
		'ach.v1.view.22222222222222222',
		'',
	])('rejects %s', (id) => {
		expect(decodeProfileViewAction(id)).toBeNull()
	})
})
