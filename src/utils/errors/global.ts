import { EmbedBuilder } from 'discord.js'
import embedColors from '../../lib/colorsConfig.js'

export class ErrorEmbeds {
	static internalErr = (description: string) => {
		return new EmbedBuilder()
			.setTitle(`Internal Error`)
			.setDescription(description)
			.setColor(embedColors.error)
	}
	static betErr = (description: string) => {
		return new EmbedBuilder()
			.setTitle(`Invalid Bet`)
			.setDescription(description)
			.setColor(embedColors.error)
	}
}
