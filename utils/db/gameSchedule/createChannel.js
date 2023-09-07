import discord from 'discord.js'
import { SapDiscClient } from '#main'
import { fetchVsImg } from '#utilBot/fetchVsImg'
import { gameEmbedOdds } from './gameEmbed.js'
import PlutoLogger from '#PlutoLogger'

const { AttachmentBuilder, ChannelType } = discord
/**
 * @module createChannel
 * Create game channel in the live games category
 */

export async function createChannel(data) {
	const { awayTeam, homeTeam } = data || null
	try {
		const guild = SapDiscClient.guilds.cache.get(
			`${process.env.server_ID}`,
		)
		const category = guild.channels.cache.get(
			`${process.env.gameCat_ID}`,
		)
		const channelName = `${awayTeam} vs ${homeTeam}`
		const gameChan = await guild.channels.create({
			name: channelName,
			type: ChannelType.GuildText,
			topic: `Enjoy the Game!`,
			parent: category,
		})

		// # Collect information about the game and send it to the game channel on creation
		const gameInfo = await gameEmbedOdds(
			homeTeam,
			awayTeam,
		)
		const matchupStr = `${awayTeam} vs ${homeTeam}`
		const imgFile = await fetchVsImg(matchupStr)
		// const imgFile = false
		if (!imgFile) {
			await gameChan.send({
				embeds: [gameInfo],
			})
		} else {
			const imageAttachment = new AttachmentBuilder(
				imgFile,
				{
					name: 'matchup.jpg',
				},
			)
			gameInfo.setImage(`attachment://matchup.jpg`)
			await gameChan.send({
				embeds: [gameInfo],
				files: [imageAttachment],
			})
		}
		await PlutoLogger.log({
			id: `2`,
			description: `Game Channel Created | ${awayTeam} vs ${homeTeam} => <#${gameChan.id}>`,
		})

		return true
	} catch (error) {
		await PlutoLogger.log({
			id: 4,
			description: `Failed to create a Game Channel | ${awayTeam} vs ${homeTeam}`,
		})
		console.error(error)
		return false
	}
}
