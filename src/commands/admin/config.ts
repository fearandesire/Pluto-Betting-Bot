import { ApplyOptions } from '@sapphire/decorators'
import { Subcommand } from '@sapphire/plugin-subcommands'
import { EmbedBuilder, InteractionContextType } from 'discord.js'
import embedColors from '../../lib/colorsConfig.js'
import { FooterManager } from '../../lib/footers/FooterManager.js'
import { FALLBACK_FOOTERS } from '../../lib/footers/fallbackFooters.js'

/**
 * Config command for managing bot settings
 *
 * Subcommand Groups:
 * - /config footer status - View footer cache status
 * - /config footer refresh - Force refresh footer cache
 * - /config footer list [category] - List footers in cache
 */
@ApplyOptions<Subcommand.Options>({
	name: 'config',
	description: 'Configure bot settings',
	preconditions: ['OwnerOnly'],
	subcommands: [
		{
			name: 'footer',
			type: 'group',
			entries: [
				{ name: 'status', chatInputRun: 'footerStatus' },
				{ name: 'refresh', chatInputRun: 'footerRefresh' },
				{ name: 'list', chatInputRun: 'footerList' },
			],
		},
	],
})
export class ConfigCommand extends Subcommand {
	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.setContexts([InteractionContextType.Guild])
					// Footer subcommand group
					.addSubcommandGroup((group) =>
						group
							.setName('footer')
							.setDescription('Manage footer configuration')
							.addSubcommand((subcommand) =>
								subcommand
									.setName('status')
									.setDescription(
										'View footer cache status and statistics',
									),
							)
							.addSubcommand((subcommand) =>
								subcommand
									.setName('refresh')
									.setDescription(
										'Force refresh footer cache from Khronos',
									),
							)
							.addSubcommand((subcommand) =>
								subcommand
									.setName('list')
									.setDescription('List footers in cache')
									.addStringOption((option) =>
										option
											.setName('category')
											.setDescription(
												'Filter by category (optional)',
											)
											.addChoices(
												{ name: 'Core', value: 'core' },
												{
													name: 'General',
													value: 'general',
												},
												{
													name: 'Betting',
													value: 'betting',
												},
												{
													name: 'Placed Bet',
													value: 'placedBet',
												},
												{
													name: 'High Bet',
													value: 'highBetPlaced',
												},
												{
													name: 'Low Bet',
													value: 'lowBetPlaced',
												},
											),
									),
							),
					),
			{
				idHints: [],
			},
		)
	}

	public async footerStatus(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		try {
			const manager = FooterManager.getInstance()
			const status = manager.getCacheStatus()

			const embed = new EmbedBuilder()
				.setTitle('📋 Footer Cache Status')
				.setColor(embedColors.PlutoYellow)
				.addFields(
					{
						name: '⏰ Refresh Information',
						value: `**Last Refresh:** ${status.lastRefresh ? `<t:${Math.floor(status.lastRefresh.getTime() / 1000)}:R>` : 'Never'}\n**Next Refresh:** ${status.nextRefresh ? `<t:${Math.floor(status.nextRefresh.getTime() / 1000)}:R>` : 'Unknown'}\n**TTL:** ${status.ttl}`,
						inline: false,
					},
					{
						name: '📊 Statistics',
						value: `**Total Footers:** ${status.cacheSize}\n**Categories:** ${Object.keys(status.categoryCounts).length}\n**Announcement Active:** ${status.hasAnnouncement ? '✅ Yes' : '❌ No'}`,
						inline: false,
					},
				)

			// Add category counts
			if (Object.keys(status.categoryCounts).length > 0) {
				const categoryList = Object.entries(status.categoryCounts)
					.map(
						([category, count]) =>
							`• **${category}:** ${count} footers`,
					)
					.join('\n')
				embed.addFields({
					name: '📁 Categories',
					value: categoryList,
					inline: false,
				})
			}

			await interaction.reply({ embeds: [embed], ephemeral: true })
		} catch (error) {
			this.container.logger.error(error)
			const embed = new EmbedBuilder()
				.setTitle('❌ Footer Status Error')
				.setDescription(
					'An error occurred while fetching footer cache status. Please try again.',
				)
				.setColor(embedColors.error)

			if (interaction.deferred && !interaction.replied) {
				await interaction.editReply({ embeds: [embed] })
				return
			}
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ embeds: [embed], ephemeral: true })
				return
			}
			await interaction.reply({ embeds: [embed], ephemeral: true })
		}
	}

	public async footerRefresh(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		await interaction.deferReply({ ephemeral: true })

		try {
			const manager = FooterManager.getInstance()
			const success = await manager.forceRefresh()

			const embed = new EmbedBuilder()
				.setTitle(
					success ? '✅ Footer Cache Refreshed' : '❌ Refresh Failed',
				)
				.setDescription(
					success
						? 'Footer cache has been successfully refreshed from Khronos.'
						: 'Failed to refresh footer cache. Check logs for details.',
				)
				.setColor(success ? embedColors.success : embedColors.error)

			await interaction.editReply({ embeds: [embed] })
		} catch (error) {
			this.container.logger.error(error)
			const embed = new EmbedBuilder()
				.setTitle('❌ Footer Refresh Error')
				.setDescription(
					'An error occurred while refreshing the footer cache. Please try again.',
				)
				.setColor(embedColors.error)
			await interaction.editReply({ embeds: [embed] })
		}
	}

	public async footerList(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		try {
			await interaction.deferReply({ ephemeral: true })

			const category = interaction.options.getString('category') as
				| keyof typeof FALLBACK_FOOTERS
				| null
			const manager = FooterManager.getInstance()
			const status = manager.getCacheStatus()

			const embed = new EmbedBuilder()
				.setTitle('📝 Footer List')
				.setColor(embedColors.PlutoYellow)

			if (category) {
				// Show specific category
				const footers = status.categoryCounts[category] || 0
				embed.setDescription(
					`**Category:** ${category}\n**Count:** ${footers}`,
				)
			} else {
				// Show all categories
				if (Object.keys(status.categoryCounts).length === 0) {
					embed.setDescription(
						'No footers cached. Try running `/config footer refresh`.',
					)
				} else {
					const categoryList = Object.entries(status.categoryCounts)
						.map(([cat, count]) => `• **${cat}:** ${count} footers`)
						.join('\n')
					embed.setDescription(`**All Categories:**\n${categoryList}`)
				}
			}

			embed.setFooter({
				text: `Total: ${status.cacheSize} footers cached`,
			})

			await interaction.editReply({ embeds: [embed] })
		} catch (error) {
			this.container.logger.error(error)
			const embed = new EmbedBuilder()
				.setTitle('❌ Footer List Error')
				.setDescription(
					'An error occurred while listing footer cache information. Please try again.',
				)
				.setColor(embedColors.error)

			if (interaction.deferred && !interaction.replied) {
				await interaction.editReply({ embeds: [embed] })
				return
			}
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ embeds: [embed], ephemeral: true })
				return
			}
			await interaction.reply({ embeds: [embed], ephemeral: true })
		}
	}
}
