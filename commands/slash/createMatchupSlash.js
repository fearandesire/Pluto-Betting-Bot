import { Command } from '@sapphire/framework'
import { Log } from '#config'
import { assignMatchID } from '#botUtil/AssignIDs'
import { createMatchups } from '#utilMatchups/createMatchups'
import { resolveToday } from '#dateUtil/resolveToday'
import { storeCustomMatchup } from '../../utils/bot_res/storeCustomMatchup.js'

export class createMatchupSlash extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'createMatchupSlash',
			aliases: [''],
			description:
				'Create a Custom Matchup - Used for events, testing, or if the API fails to populate a specific game',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand((builder) =>
			builder //
				.setName('creatematchup')
				.setDescription(this.description)
				.addStringOption((option) =>
					option // Options to add should be the home team, the away team, and the odds for both teams
						.setName('teamone')
						.setDescription('Home Team')
						.setRequired(true),
				)
				.addStringOption((option) =>
					option
						.setName('teamtwo')
						.setDescription('Away Team')
						.setRequired(true),
				)
				.addNumberOption((option) =>
					option
						.setName('teamoneodds')
						.setDescription('Home Team Odds')
						.setRequired(true),
				)
				.addNumberOption((option) =>
					option
						.setName('teamtwoodds')
						.setDescription('Away Team Odds')
						.setRequired(true),
				)
				//# add Integer options for the day, hour and time the matchup begins
				.addIntegerOption((option) =>
					option
						.setName('day')
						.setDescription(
							'Date of the month this matchup begins (E.g, the 10th of this month - you would just write 10)',
						)
						.setRequired(true),
				)
				.addIntegerOption((option) =>
					option
						.setName('hour')
						.setDescription('The hour this matchup begins (Eastern Timezone)')
						.setRequired(true),
				)
				.addIntegerOption((option) =>
					option
						.setName('minute')
						.setDescription('The minute this matchup begins')
						.setRequired(true),
				)
				.addStringOption((option) =>
					option
						.setName('am_or_pm')
						.setDescription('AM or PM?')
						.addChoices(
							{
								name: 'AM',
								value: 'AM',
							},
							{
								name: 'PM',
								value: 'PM',
							},
						)
						.setRequired(true),
				),
		)
	}
	//    { idHints: [`1022940422974226432`] },
	async chatInputRun(interaction) {
		if (!interaction.guildId) {
			interaction.reply({
				content: `This command can only be used in a server.`,
				ephemeral: true,
			})
			return
		}
		var userid = interaction.user.id
		Log.Yellow(`${userid} has created a custom matchup.`)
		var assignMatchupIds = await assignMatchID()
		var teamone = await interaction.options.getString('teamone')
		var teamtwo = await interaction.options.getString('teamtwo')
		var teamoneodds = await interaction.options.getNumber('teamoneodds')
		var teamtwoodds = await interaction.options.getNumber('teamtwoodds')
		var dayNum = await interaction.options.getInteger('day')
		var hourNum = await interaction.options.getInteger('hour')
		var minuteNum = await interaction.options.getInteger('minute')
		var amOrPm = await interaction.options.getString('am_or_pm')
		//# Convert the hour to 24 hour time if PM is selected
		if (amOrPm == 'PM') {
			hourNum = hourNum + 12
		}
		var tDay = await new resolveToday()
		var year = tDay.todaysYear
		var month = tDay.todaysMonth
		var gameDate = `${month}/${dayNum}/${year}`
		var matchupObj = {
			[`home_team`]: teamone,
			[`away_team`]: teamtwo,
			[`home_teamOdds`]: teamoneodds,
			[`away_teamOdds`]: teamtwoodds,
			[`matchupId`]: assignMatchupIds,
			[`mdyDate`]: gameDate,
			[`dayNum`]: dayNum,
			[`hour`]: hourNum,
			[`minute`]: minuteNum,
		}
		await storeCustomMatchup(matchupObj).then(async (res) => {
			if (res === false) {
				await interaction.reply({
					content: `There was an error creating this matchup into cache.`,
					ephemeral: true,
				})
				return
			} else {
				await createMatchups(
					interaction,
					teamone,
					teamtwo,
					teamoneodds,
					teamtwoodds,
					assignMatchupIds,
					gameDate,
				)
				await interaction.reply({
					content: `Matchup created!`,
					ephemeral: true,
				})
			}
		})
	}
}
