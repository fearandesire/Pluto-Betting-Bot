import type { Client, Guild, User } from 'discord.js'
import {
	type ProfileViewOptions,
	profileViewPayload,
} from '../../lib/discord/builders/profile-views.js'
import { selectProfileView } from '../../lib/profile/profile-view.js'
import env from '../../lib/startup/env.js'
import { handleNewUser } from '../api/common/handleNewUser.js'
import AchievementsWrapper from '../api/Khronos/achievements/achievements-wrapper.js'
import { AccountsWrapper } from '../api/requests/accounts/AccountManager.js'
import {
	type LoadedProfileView,
	loadProfileViewData,
} from './load-profile-view.js'

export interface ProfileSubject {
	userId: string
	displayName: string
	avatarUrl: string | null
}

/** Name and avatar as the guild shows them, falling back to the global user. */
export async function resolveProfileSubject(
	ctx: { guild: Guild | null; client: Client },
	userId: string,
	known?: User,
): Promise<ProfileSubject> {
	const member = ctx.guild?.members.cache.get(userId)
	const user =
		known ??
		member?.user ??
		(await ctx.client.users.fetch(userId).catch(() => null))
	const avatar = member ?? user
	return {
		userId,
		displayName:
			member?.displayName ??
			user?.globalName ??
			user?.username ??
			'Player',
		avatarUrl:
			avatar?.displayAvatarURL({ extension: 'png', size: 128 }) ?? null,
	}
}

/** Loads a profile for the new views. Throws when Khronos achievements are unavailable. */
export async function loadProfileForViews(
	subject: ProfileSubject,
): Promise<LoadedProfileView | null> {
	const accounts = new AccountsWrapper()
	return await loadProfileViewData(
		{
			accounts: {
				getProfile: async (id) => {
					const profile = await accounts.getProfile(id)
					// Same welcome flow as /account profile for first-time users.
					handleNewUser(profile)
					return profile
				},
			},
			achievements: new AchievementsWrapper(),
		},
		subject,
	)
}

/** The view to draw, or null when the flag is off and the PNG card applies. */
export function viewFor(loaded: LoadedProfileView) {
	const view = selectProfileView({
		enabled: env.PROFILE_VIEWS_ENABLED,
		preference: loaded.preference,
	})
	return view === 'classic' ? null : view
}

export function profileViewMessage(
	loaded: LoadedProfileView,
	opts: Omit<ProfileViewOptions, 'view' | 'model'>,
) {
	const view = viewFor(loaded)
	return view
		? profileViewPayload({ ...opts, view, model: loaded.model })
		: null
}
