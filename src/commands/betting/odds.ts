import { ApplyOptions } from '@sapphire/decorators'
import { Command } from '@sapphire/framework'
import { prepareAndFormat } from '../../utils/matchups/OddsProcessing.js'
import { QuickError } from '@pluto-embed-reply'
import GuildWrapper from '../../utils/api/Khronos/guild/guild-wrapper.js'
import MatchApiWrapper from '../../utils/api/Khronos/matches/matchApiWrapper.js'

@ApplyOptions<Command.Options>({
	description: '🔎 View current matchups & odds',
})
export class UserCommand extends Command {
	public override registerApplicationCommands(registry: Command.Registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName(this.name)
				.setDescription(this.description),
		)
	}

	public override async chatInputRun(
		interaction: Command.ChatInputCommandInteraction,
	) {
		await interaction.deferReply()
		if (!interaction.guild) {
			return QuickError(
				interaction,
				`This command must be accessed from a guild.`,
			)
		}
		const guildId = interaction.guild.id
		const embedThumbnail = interaction.guild.iconURL({ extension: 'jpg' })
		if (!embedThumbnail) return QuickError(interaction, `An error occurred`)
		const guildConfig = await new GuildWrapper().getGuild(guildId)
		const sport = guildConfig.sport
		const matchupsForGuild = await new MatchApiWrapper().matchesForSport({
			sport: sport.toLowerCase(),
		})
		const { matches } = matchupsForGuild
		const oddsEmbed = await prepareAndFormat(matches, embedThumbnail)
		if (!oddsEmbed)
			return QuickError(
				interaction,
				`An error occurred when presenting odds.`,
			)
		return interaction.followUp({
			embeds: [oddsEmbed],
		})
	}
}
