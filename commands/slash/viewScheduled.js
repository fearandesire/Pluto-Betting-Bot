import { Command } from '@sapphire/framework'
import { MessageEmbed } from 'discord.js'
import { format } from 'date-fns'
import { _, QuickError, helpfooter } from '#config'
import { SPORT } from '#env'
import Cache from '#rCache'
import PlutoLogger from '#PlutoLogger'

export class viewScheduled extends Command {
	constructor(context, options) {
		super(context, {
			...options,
			name: 'viewScheduled',
			aliases: [''],
			description:
				'View the scheduled game channels.',
			chatInputCommand: {
				register: true,
			},
		})
	}

	registerApplicationCommands(registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder //
					.setName('viewscheduled')
					.setDescription(this.description),
			//    { idHints: [`1022940422974226432`] },
		)
	}

	async chatInputRun(interaction) {
		if (!interaction.guildId) {
			interaction.reply({
				content: `This command can only be used in a server.`,
				ephemeral: true,
			})
			return
		}
		const scheduled = await Cache().get(`scheduled`)
		if (!scheduled || _.isEmpty(scheduled)) {
			await interaction.reply({
				content: `There are no games currently scheduled to be created.`,
				ephemeral: true,
			})
			return
		}

		const createMatchStr = (game) =>
			`${game.away_team} *@* ${game.home_team}`

		// Group the scheduled games by day using Lodash's `groupBy` function
		const groupedGames = _.groupBy(
			scheduled,
			(game) => {
				const gameDate = new Date(game.date)
				return _.startCase(
					_.lowerCase(format(gameDate, 'EEEE')),
				)
			},
		)
		let dayOrder

		if (SPORT === 'nfl') {
			dayOrder = [
				'Thursday',
				'Friday',
				'Saturday',
				'Sunday',
				'Monday',
				'Tuesday',
				'Wednesday',
			]
		} else if (SPORT === 'nba') {
			dayOrder = [
				'Monday',
				'Tuesday',
				'Wednesday',
				'Thursday',
				'Friday',
				'Saturday',
				'Sunday',
			]
		} else {
			await QuickError(
				interaction,
				`Unable to view scheduled games - It appears something is setup wrong with the app!`,
			)
			await PlutoLogger.log({
				title: `Game Scheduling Logs`,
				description: `Error: ${SPORT} is not supported.\nCheck app configuration\nCmd: ${interaction.commandName} | Called By User: ${interaction.user.tag}`,
			})
			return
		}

		// Sort the grouped games by day using Lodash's `orderBy` function
		const sortedGroupedGames = _.orderBy(
			Object.entries(groupedGames),
			([day]) => _.indexOf(dayOrder, day),
			['asc'],
		)

		// Create the Discord Embed
		const emb = new MessageEmbed()
			.setTitle(`Scheduled Games`)
			.setColor('#e0ff19')
			.setFooter({ text: helpfooter })

		// Add fields for each day and its corresponding games
		sortedGroupedGames.forEach(([day, games]) => {
			const gamesStr = games
				.map(createMatchStr)
				.join('\n')
			emb.addField(day, gamesStr)
		})

		await interaction.reply({
			embeds: [emb],
		})
	}
}
