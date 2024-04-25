import { EmbedBuilder } from 'discord.js'
import embedColors from '../../../lib/colorsConfig.js'
import { helpfooter } from '@pluto-core-config'
import { nonPatreonMemberMsg } from '../../api/patreon/interfaces.js'

/**
 * @summary Generates Error Embeds
 *
 * Utilizing a factory pattern, this class will dynamically create 'error' embeds
 */
export class ErrorEmbeds {
	// Generalized method for creating error embeds
	static createErrorEmbed(
		title: string,
		description: string,
		extraData?: { footerData?: string; [key: string]: any },
	) {
		return new EmbedBuilder()
			.setTitle(title)
			.setDescription(description)
			.setColor(embedColors.error)
			.setFooter({
				text: extraData
					? extraData.footerData + ' | ' + helpfooter()
					: helpfooter(),
			})
	}

	// Specific error methods just call the generalized method with predefined titles
	static patreonMembersOnly() {
		return this.createErrorEmbed('Access Denied', nonPatreonMemberMsg)
	}
	static internalErr(description: string) {
		return this.createErrorEmbed('Internal Error', description)
	}

	static betErr(description: string) {
		return this.createErrorEmbed('Invalid Bet', description)
	}

	static invalidRequest(description: string) {
		return this.createErrorEmbed('Invalid Request', description)
	}

	static accountErr(description: string) {
		return this.createErrorEmbed('Account Error', description)
	}

	static unknownErr(description: string) {
		return this.createErrorEmbed('Unknown Error', description)
	}
}
