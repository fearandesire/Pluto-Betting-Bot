export const PROFILE_VIEWS = ['headline', 'trophy_shelf'] as const

export type ProfileView = (typeof PROFILE_VIEWS)[number]

export const DEFAULT_PROFILE_VIEW: ProfileView = 'headline'

export const PROFILE_VIEW_LABELS: Readonly<Record<ProfileView, string>> = {
	headline: 'Headline',
	trophy_shelf: 'Trophy Shelf',
}

/** Latest achievements a collapsed profile shows. */
export const COLLAPSED_ACHIEVEMENT_LIMIT = 3

/** Trophy Shelf rows per page once expanded. */
export const SHELF_PAGE_SIZE = 5

export const isProfileView = (value: unknown): value is ProfileView =>
	PROFILE_VIEWS.some((view) => view === value)

/**
 * `classic` is today's PNG card. With the flag on, an unset or unknown
 * preference reads as Headline.
 */
export function selectProfileView(opts: {
	enabled: boolean
	preference: unknown
}): 'classic' | ProfileView {
	if (!opts.enabled) return 'classic'
	return isProfileView(opts.preference)
		? opts.preference
		: DEFAULT_PROFILE_VIEW
}

/** How many earned achievements a collapsed profile lists. */
export const collapsedAchievementCount = (earned: number): number =>
	Math.max(0, Math.min(earned, COLLAPSED_ACHIEVEMENT_LIMIT))

export const shelfPageCount = (items: number): number =>
	Math.max(1, Math.ceil(items / SHELF_PAGE_SIZE))
