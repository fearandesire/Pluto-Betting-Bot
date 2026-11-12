import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import { type ButtonInteraction, MessageFlags } from 'discord.js'
import {
	achievementsPayload,
	decodeAchievementsPage,
	decodeAchievementsView,
} from '../lib/discord/builders/achievements.js'
import { profileNoticePayload } from '../lib/discord/builders/profile.js'
import env from '../lib/startup/env.js'
import AchievementsWrapper from '../utils/api/Khronos/achievements/achievements-wrapper.js'
import { logger } from '../utils/logging/WinstonLogger.js'
import { loadAchievementsView } from '../utils/profile-card/load-achievements.js'

export class AchievementsViewHandler extends InteractionHandler {
	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Button,
		})
	}

	public override parse(interaction: ButtonInteraction) {
		const opened = decodeAchievementsView(interaction.customId)
		if (opened) return this.some({ targetId: opened, page: null })
		const paged = decodeAchievementsPage(interaction.customId)
		return paged ? this.some(paged) : this.none()
	}

	public override async run(
		interaction: ButtonInteraction,
		{ targetId, page }: { targetId: string; page: number | null },
	) {
		// Previous and Next edit the private reply in place; the profile
		// button opens a new private reply.
		if (page === null) {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral })
		} else {
			await interaction.deferUpdate()
		}
		const notice = (message: string) =>
			interaction.editReply(profileNoticePayload(message))

		if (!env.PROFILE_ENABLED) {
			return notice('Achievements are not available yet.')
		}

		let achievements: AchievementsWrapper
		try {
			achievements = new AchievementsWrapper()
		} catch (error) {
			logger.warn({
				message: 'Achievements API unavailable',
				metadata: { source: 'AchievementsViewHandler', error },
			})
			return notice('Achievements are not available yet.')
		}

		try {
			const view = await loadAchievementsView(achievements, targetId)
			if (!view) {
				return notice(
					'Could not load achievements right now. Please try again.',
				)
			}
			return await interaction.editReply(
				achievementsPayload(
					view,
					await this.displayName(interaction, targetId),
					{ targetId, page: page ?? 0 },
				),
			)
		} catch (error) {
			logger.error({
				message: 'Failed to build achievements list',
				metadata: {
					source: 'AchievementsViewHandler',
					targetId,
					error,
				},
			})
			return notice(
				'Could not load achievements right now. Please try again.',
			)
		}
	}

	private async displayName(interaction: ButtonInteraction, userId: string) {
		const member = interaction.guild?.members.cache.get(userId)
		if (member) return member.displayName
		try {
			const user = await interaction.client.users.fetch(userId)
			return user.globalName ?? user.username
		} catch {
			return 'Player'
		}
	}
}
