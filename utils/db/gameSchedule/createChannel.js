import { MessageAttachment } from 'discord.js'
import { SapDiscClient } from '#main'
import { createChanLog } from '#winstonLogger'
import { fetchVsImg } from '#utilBot/fetchVsImg'
import dmMe from '../../bot_res/dmMe.js'
import {
	gameEmbedOdds,
	gameEmbedPlain,
} from './gameEmbed.js'

/**
 * @module createChannel
 * Create game channel in the live games category
 */

export async function createChannel(data) {
	const { awayTeam, homeTeam } = data || null
	createChanLog.info(
		`Creating Game Channel | Title: ${awayTeam} vs ${homeTeam}`,
	)
	try {
		const guild = SapDiscClient.guilds.cache.get(
			`${process.env.server_ID}`,
		)
		const category = guild.channels.cache.get(
			`${process.env.gameCat_ID}`,
		)
		const channelName = `${awayTeam} vs ${homeTeam}`
		const gameChan = await guild.channels.create(
			channelName,
			{
				type: 'text',
				topic: `Enjoy the Game!`,
				parent: category,
			},
		)

		// # Collect information about the game and send it to the game channel on creation
		const gameInfo = await gameEmbedPlain(
			homeTeam,
			awayTeam,
		)
		//     const imgFile = await fetchVsImg(matchupStr)
		const imgFile = false
		if (!imgFile) {
			await gameChan.send({ embeds: [gameInfo] })
		} else {
			const imageAttachment = new MessageAttachment(
				imgFile,
				'matchup.jpg',
			)
			gameInfo.setImage(`attachment://matchup.jpg`)
			await gameChan.send({
				embeds: [gameInfo],
				files: [imageAttachment],
			})
		}
		await dmMe(
			`${channelName} Game Channel created successfully\nDirect Link: <#${gameChan.id}>`,
		)
		createChanLog.info(
			`Game Channel Created: ${channelName}`,
		)

		return `${channelName} Game Channel created successfully\nDirect Link: <#${gameChan.id}>`
	} catch (error) {
		createChanLog.error(
			`Error Creating Game Channel: ${error}`,
		)
	}
}
