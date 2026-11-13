import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import {
	type Interaction,
	type MessageComponentInteraction,
	MessageFlags,
	type StringSelectMenuInteraction,
} from 'discord.js'
import {
	decodeProfileViewAction,
	type ProfileViewAction,
} from '../lib/discord/builders/profile-view-ids.js'
import {
	profileSettingsPayload,
	profileSharedViewPayload,
	profileViewPayload,
} from '../lib/discord/builders/profile-views.js'
import { text, v2EditFlags, v2Payload } from '../lib/discord/v2/kit.js'
import {
	DEFAULT_PROFILE_VIEW,
	isProfileView,
	selectProfileView,
} from '../lib/profile/profile-view.js'
import env from '../lib/startup/env.js'
import { AccountsWrapper } from '../utils/api/requests/accounts/AccountManager.js'
import { logger } from '../utils/logging/WinstonLogger.js'
import {
	loadProfileForViews,
	resolveProfileSubject,
	viewFor,
} from '../utils/profile-card/profile-view-service.js'

/** Bounds the claim map; a re-share after this window equals re-running /profile. */
const CLAIM_TTL_MS = 15 * 60 * 1000
const claimed = new Map<string, number>()

const prune = (now: number) => {
	for (const [id, at] of claimed)
		if (now - at > CLAIM_TTL_MS) claimed.delete(id)
}

const notice = (content: string) =>
	v2Payload({ blocks: [text(content)], ephemeral: true })

const editable = <T extends { flags: number }>(payload: T) => ({
	...payload,
	flags: v2EditFlags(),
})

/** Routes every `profile.v2.*` control: expand, collapse, share, settings and the view select. */
export class ProfileViewHandler extends InteractionHandler {
	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.MessageComponent,
		})
	}

	public override parse(interaction: Interaction) {
		if (!interaction.isMessageComponent()) return this.none()
		const action = decodeProfileViewAction(interaction.customId)
		return action ? this.some(action) : this.none()
	}

	public override async run(
		interaction: Interaction,
		action: ProfileViewAction,
	) {
		if (!interaction.isMessageComponent()) return
		if (interaction.user.id !== action.ownerId) {
			await interaction.reply(
				notice(
					'Only the person who ran /profile can use these controls.',
				),
			)
			return
		}
		if (!env.PROFILE_VIEWS_ENABLED) {
			await interaction.reply(
				notice('Profile views are not available yet.'),
			)
			return
		}
		try {
			switch (action.kind) {
				case 'expand':
				case 'collapse':
					return await this.toggle(interaction, action)
				case 'share':
					return await this.share(interaction, action)
				case 'settings':
					return await this.openSettings(interaction, action.ownerId)
				case 'setview':
					return await this.saveView(
						interaction as StringSelectMenuInteraction,
						action.ownerId,
					)
			}
		} catch (error) {
			logger.error({
				message: 'Profile view control failed',
				metadata: {
					source: 'ProfileViewHandler',
					kind: action.kind,
					error,
				},
			})
			const message = notice('Something went wrong. Run /profile again.')
			try {
				if (interaction.deferred || interaction.replied)
					await interaction.followUp(message)
				else await interaction.reply(message)
			} catch {
				// Interaction token expired; nothing left to tell the user.
			}
		}
	}

	private async load(
		interaction: MessageComponentInteraction,
		userId: string,
	) {
		const subject = await resolveProfileSubject(interaction, userId)
		return await loadProfileForViews(subject)
	}

	private async toggle(
		interaction: MessageComponentInteraction,
		action: Extract<ProfileViewAction, { kind: 'expand' | 'collapse' }>,
	) {
		await interaction.deferUpdate()
		const loaded = await this.load(interaction, action.targetId)
		const view = loaded && viewFor(loaded)
		if (!loaded || !view) {
			await interaction.followUp(
				notice(
					'Could not load that profile right now. Please try again.',
				),
			)
			return
		}
		await interaction.editReply(
			editable(
				profileViewPayload({
					view,
					model: loaded.model,
					route: { ownerId: action.ownerId },
					expanded: action.kind === 'expand',
					shared: claimed.has(interaction.message.id),
					page: action.kind === 'expand' ? action.page : 0,
				}),
			),
		)
	}

	private async share(
		interaction: MessageComponentInteraction,
		action: Extract<ProfileViewAction, { kind: 'share' }>,
	) {
		const messageId = interaction.message.id
		const now = Date.now()
		prune(now)
		if (claimed.has(messageId)) {
			await interaction.reply(notice('This card was already shared.'))
			return
		}
		claimed.set(messageId, now)
		try {
			await interaction.deferUpdate()
			const loaded = await this.load(interaction, action.targetId)
			const view = loaded && viewFor(loaded)
			if (!loaded || !view) throw new Error('profile could not be loaded')
			const opts = {
				view,
				model: loaded.model,
				route: { ownerId: action.ownerId },
			}
			await interaction.followUp(
				profileSharedViewPayload(opts, interaction.user.id),
			)
			// Already public. A failed button update must not trigger a second post.
			try {
				await interaction.editReply(
					editable(profileViewPayload({ ...opts, shared: true })),
				)
			} catch (error) {
				logger.warn({
					message: 'Profile share button could not be disabled',
					metadata: { source: 'ProfileViewHandler', error },
				})
			}
		} catch (error) {
			claimed.delete(messageId)
			throw error
		}
	}

	private async currentPreference(userId: string) {
		const profile = await new AccountsWrapper().getProfile(userId)
		return selectProfileView({
			enabled: true,
			preference: (profile as { profile_view?: unknown }).profile_view,
		})
	}

	private async openSettings(
		interaction: MessageComponentInteraction,
		ownerId: string,
	) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral })
		const current = await this.currentPreference(ownerId)
		await interaction.editReply(
			editable(
				profileSettingsPayload({
					ownerId,
					current:
						current === 'classic' ? DEFAULT_PROFILE_VIEW : current,
				}),
			),
		)
	}

	private async saveView(
		interaction: StringSelectMenuInteraction,
		ownerId: string,
	) {
		const choice = interaction.values[0]
		if (!isProfileView(choice)) {
			await interaction.reply(notice('That view is not available.'))
			return
		}
		await interaction.deferUpdate()
		const saved = await new AccountsWrapper().setProfileView(
			ownerId,
			choice,
		)
		if (!saved) {
			await interaction.followUp(
				notice('Saving a default view is not available yet.'),
			)
			return
		}
		await interaction.editReply(
			editable(
				profileSettingsPayload({
					ownerId,
					current: choice,
					saved: true,
				}),
			),
		)
	}
}
