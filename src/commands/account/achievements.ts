import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { InteractionContextType, MessageFlags } from 'discord.js'
import { achievementsPayload } from '../../lib/discord/builders/achievements.js'
import { profileNoticePayload } from '../../lib/discord/builders/profile.js'
import env from '../../lib/startup/env.js'
import AchievementsWrapper from '../../utils/api/Khronos/achievements/achievements-wrapper.js'
import { loadAchievementsView } from '../../utils/profile-card/load-achievements.js'

@ApplyOptions<Command.Options>({
	description: '🏅 See every badge you can earn and your progress',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		// Rides on the profile flag: one switch turns both commands on.
		if (!env.PROFILE_ENABLED) return
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description)
				.setContexts(InteractionContextType.Guild)
				.addUserOption((option) =>
					option
						.setName('user')
						.setDescription('Optional | User to view')
						.setRequired(false),
				),
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral })
		const notice = (message: string) =>
			interaction.editReply(profileNoticePayload(message))

		if (!env.PROFILE_ENABLED) {
			return notice('Achievements are not available yet.')
		}

		const target = interaction.options.getUser('user') ?? interaction.user
		if (target.bot) {
			return notice('Bots do not have achievements.')
		}

		let achievements: AchievementsWrapper
		try {
			achievements = new AchievementsWrapper()
		} catch (error) {
			this.container.logger.warn('Achievements API unavailable', error)
			return notice('Achievements are not available yet.')
		}

		try {
			const view = await loadAchievementsView(achievements, target.id)
			if (!view) {
				return notice(
					'Could not load achievements right now. Please try again.',
				)
			}
			const displayName =
				interaction.guild?.members.cache.get(target.id)?.displayName ??
				target.globalName ??
				target.username
			return await interaction.editReply(
				achievementsPayload(view, displayName, { targetId: target.id }),
			)
		} catch (error) {
			this.container.logger.error('Failed to build achievements list', {
				userId: target.id,
				error,
			})
			return notice(
				'Could not load achievements right now. Please try again.',
			)
		}
	}
}
