import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import type { ButtonInteraction } from 'discord.js'
import { text, v2EditFlags, v2Payload } from '../lib/discord/v2/kit.js'
import {
	decodePageNav,
	getPageSource,
	type PageNav,
	renderPage,
} from '../lib/discord/v2/paginator.js'

const notice = (content: string) =>
	v2Payload({ blocks: [text(content)], ephemeral: true })

/** Routes every `pg.v1.*` button to its registered page source. */
export class V2PaginationHandler extends InteractionHandler {
	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Button,
		})
	}

	public override parse(interaction: ButtonInteraction) {
		const route = decodePageNav(interaction.customId)
		return route ? this.some(route) : this.none()
	}

	public override async run(interaction: ButtonInteraction, route: PageNav) {
		const source = getPageSource(route.scope)
		if (!source) {
			await interaction.reply(
				notice('This menu expired — run the command again.'),
			)
			return
		}

		if (
			source.ownerOnly &&
			interaction.user.id !==
				interaction.message.interactionMetadata?.user.id
		) {
			await interaction.reply(
				notice(
					'Only the person who ran this command can use these buttons.',
				),
			)
			return
		}

		await interaction.deferUpdate()
		const data = await source.load(interaction, route.page)
		await interaction.editReply({
			...renderPage(data),
			flags: v2EditFlags(),
		})
	}
}
