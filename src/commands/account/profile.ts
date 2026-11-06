import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { InteractionContextType, MessageFlags } from 'discord.js'
import {
	profileCardPayload,
	profileNoticePayload,
} from '../../lib/discord/builders/profile.js'
import env from '../../lib/startup/env.js'
import { handleNewUser } from '../../utils/api/common/handleNewUser.js'
import AchievementsWrapper from '../../utils/api/Khronos/achievements/achievements-wrapper.js'
import { AccountsWrapper } from '../../utils/api/requests/accounts/AccountManager.js'
import { loadProfileCardData } from '../../utils/profile-card/load-profile-card-data.js'
import {
	describeProfileCard,
	renderProfileCard,
} from '../../utils/profile-card/profile-card.js'

@ApplyOptions<Command.Options>({
	description: '🪪 View a profile card with stats and badges',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		// Stays unregistered until Khronos ships the achievements API.
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
			return notice('Profiles are not available yet.')
		}

		const target = interaction.options.getUser('user') ?? interaction.user
		if (target.bot) {
			return notice('Bots do not have profiles.')
		}

		let achievements: AchievementsWrapper
		try {
			achievements = new AchievementsWrapper()
		} catch (error) {
			this.container.logger.warn('Achievements API unavailable', error)
			return notice('Profiles are not available yet.')
		}

		try {
			const accounts = new AccountsWrapper()
			const displayName =
				interaction.guild?.members.cache.get(target.id)?.displayName ??
				target.globalName ??
				target.username
			const data = await loadProfileCardData(
				{
					accounts: {
						getProfile: async (id) => {
							const profile = await accounts.getProfile(id)
							// Same welcome flow as /account profile for first-time users.
							handleNewUser(profile)
							return profile
						},
					},
					achievements,
				},
				target.id,
				displayName,
			)
			if (!data) {
				return notice(
					'Could not load that profile right now. Please try again.',
				)
			}
			const png = await renderProfileCard(data)
			return await interaction.editReply(
				profileCardPayload({
					png,
					description: describeProfileCard(data),
					route: {
						ownerId: interaction.user.id,
						targetId: target.id,
					},
				}),
			)
		} catch (error) {
			this.container.logger.error('Failed to build profile card', {
				userId: target.id,
				error,
			})
			return notice(
				'Could not build that profile card. Please try again.',
			)
		}
	}
}
