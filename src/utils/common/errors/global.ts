import { helpfooter } from '@pluto-config';
import { EmbedBuilder } from 'discord.js';
import embedColors from '../../../lib/colorsConfig.js';
import { nonPatreonMemberMsg } from '../../api/patreon/interfaces.js';

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
					? `${extraData.footerData} | ${helpfooter()}`
					: helpfooter(),
			});
	}

	// Specific error methods just call the generalized method with predefined titles
	static patreonMembersOnly() {
		return ErrorEmbeds.createErrorEmbed('Access Denied', nonPatreonMemberMsg);
	}
	static internalErr(description: string) {
		return ErrorEmbeds.createErrorEmbed('Internal Error', description);
	}

	static betErr(description: string) {
		return ErrorEmbeds.createErrorEmbed('Invalid Bet', description);
	}

	static invalidRequest(description: string) {
		return ErrorEmbeds.createErrorEmbed('Invalid Request', description);
	}

	static accountErr(description: string) {
		return ErrorEmbeds.createErrorEmbed('Account Error', description);
	}

	static propsErr(description: string) {
		return ErrorEmbeds.createErrorEmbed('Props Error', description);
	}

	static predictionsErr(description: string) {
		return ErrorEmbeds.createErrorEmbed('Predictions Error', description);
	}

	static unknownErr(description: string) {
		return ErrorEmbeds.createErrorEmbed('Unknown Error', description);
	}
}
