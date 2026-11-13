const PREFIX = 'profile.v2'
const SNOWFLAKE = /^\d{17,20}$/
const PAGE = /^\d{1,3}$/

/** Every control on a Headline or Trophy Shelf message. */
export type ProfileViewAction =
	| { kind: 'expand'; ownerId: string; targetId: string; page: number }
	| { kind: 'collapse'; ownerId: string; targetId: string }
	| { kind: 'share'; ownerId: string; targetId: string }
	| { kind: 'settings'; ownerId: string }
	| { kind: 'setview'; ownerId: string }

/**
 * `profile.v2.<kind>.<ownerId>[.<targetId>[.<page>]]`. The owner is the
 * invoker, so only they can drive their own message.
 */
export function encodeProfileViewAction(action: ProfileViewAction): string {
	if (!SNOWFLAKE.test(action.ownerId))
		throw new Error('invalid profile view owner id')
	if ('targetId' in action && !SNOWFLAKE.test(action.targetId))
		throw new Error('invalid profile view target id')
	switch (action.kind) {
		case 'expand':
			if (
				!Number.isInteger(action.page) ||
				action.page < 0 ||
				action.page > 999
			)
				throw new Error('invalid profile view page')
			return `${PREFIX}.expand.${action.ownerId}.${action.targetId}.${action.page}`
		case 'collapse':
		case 'share':
			return `${PREFIX}.${action.kind}.${action.ownerId}.${action.targetId}`
		case 'settings':
		case 'setview':
			return `${PREFIX}.${action.kind}.${action.ownerId}`
	}
}

export function decodeProfileViewAction(
	customId: string,
): ProfileViewAction | null {
	const [ns, version, kind, ownerId, targetId, page, ...extra] =
		customId.split('.')
	if (`${ns}.${version}` !== PREFIX || extra.length) return null
	if (!ownerId || !SNOWFLAKE.test(ownerId)) return null
	if (kind === 'settings' || kind === 'setview')
		return targetId === undefined ? { kind, ownerId } : null
	if (!targetId || !SNOWFLAKE.test(targetId)) return null
	if (kind === 'expand')
		return page !== undefined && PAGE.test(page)
			? { kind, ownerId, targetId, page: Number(page) }
			: null
	if (kind === 'collapse' || kind === 'share')
		return page === undefined ? { kind, ownerId, targetId } : null
	return null
}
