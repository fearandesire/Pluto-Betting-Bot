import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { ChannelType, PermissionFlagsBits } from 'discord.js'
import { DEV_IDS } from '../../lib/configs/constants.js'

@ApplyOptions<Command.Options>({
	description: 'Delete all game channels with "at" in their name',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.setDefaultMemberPermissions(
						PermissionFlagsBits.Administrator,
					),
			{ guildIds: [DEV_IDS.guild] },
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply()

		try {
			const targetCategoryId = DEV_IDS.gameCategory

			// Force fetch all channels to ensure we have the latest data
			await interaction.guild?.channels.fetch()

			const category =
				await interaction.guild?.channels.fetch(targetCategoryId)

			if (!category) {
				return interaction.editReply('Target category not found.')
			}

			const channelsToDelete = interaction.guild?.channels.cache.filter(
				(channel) =>
					channel.parentId === targetCategoryId &&
					channel.type === ChannelType.GuildText &&
					channel.name.toLowerCase().includes('at'),
			)

			if (!channelsToDelete || channelsToDelete.size === 0) {
				return interaction.editReply('No channels found to delete.')
			}

			// Create an array of deletion promises
			const deletionPromises = channelsToDelete.map(async (channel) => {
				try {
					await channel.fetch() // Ensure channel still exists
					return channel.delete()
				} catch (error) {
					return Promise.reject({ channelId: channel.id, error })
				}
			})

			// Execute all deletions concurrently and wait for results
			const results = await Promise.allSettled(deletionPromises)

			const succeeded = results.filter(
				(r) => r.status === 'fulfilled',
			).length
			const failed = results.filter((r) => r.status === 'rejected').length

			// Log failures for debugging
			for (const result of results) {
				if (result.status === 'rejected') {
					this.container.logger.error(
						'Channel deletion failed:',
						result.reason,
					)
				}
			}

			return interaction.editReply(
				`Operation complete:\n- Successfully deleted: ${succeeded} channels\n- Failed: ${failed} channels${
					failed > 0 ? '\n(Check logs for details)' : ''
				}`,
			)
		} catch (error) {
			this.container.logger.error('Error in cleargames command:', error)
			return interaction.editReply(
				'An error occurred while processing the command. Please check the logs.',
			)
		}
	}
}
