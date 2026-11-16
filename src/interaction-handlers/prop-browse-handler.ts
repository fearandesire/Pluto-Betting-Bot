import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import { type ButtonInteraction, MessageFlags } from 'discord.js'
import { decodePropsBrowseCustomId } from '../lib/discord/builders/prop-board.js'
import { text, v2EditFlags, v2Payload } from '../lib/discord/v2/kit.js'
import {
	type PageSource,
	PageSourceExpiredError,
	registerPageSource,
	renderPage,
} from '../lib/discord/v2/paginator.js'
import { logger } from '../utils/logging/WinstonLogger.js'
import {
	loadPropBrowse,
	PROP_BROWSE_TTL_SECONDS,
} from '../utils/props/PropBrowseCache.js'

const PER_PAGE = 8

const notice = (content: string) =>
	v2Payload({ blocks: [text(content)], ephemeral: true })

/**
 * Routes `props.browse.v1.<token>` buttons: opens one game day's props as a
 * private, paginated list. The `pg.v1.*` nav buttons need a page source, so
 * this handler registers one for its token before answering.
 */
export class PropBrowseHandler extends InteractionHandler {
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
		const token = decodePropsBrowseCustomId(interaction.customId)
		return token ? this.some(token) : this.none()
	}

	public override async run(interaction: ButtonInteraction, token: string) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral })
		const state = await loadPropBrowse(token)
		if (!state) {
			await interaction.editReply({
				...notice(
					'This props list expired. Run the props command again.',
				),
				flags: v2EditFlags(),
			})
			return
		}

		// The source holds only the token. Each page reads the list from Redis,
		// so an expired list answers "expired" and no list stays in memory.
		const source: PageSource = {
			load: async (_interaction, page) => {
				const current = await loadPropBrowse(token)
				if (!current) throw new PageSourceExpiredError(token)
				return {
					scope: token,
					title: current.title,
					lines: current.lines,
					page,
					perPage: PER_PAGE,
				}
			},
		}
		registerPageSource(token, source, {
			ttlMs: PROP_BROWSE_TTL_SECONDS * 1000,
		})
		try {
			await interaction.editReply({
				...renderPage({
					scope: token,
					title: state.title,
					lines: state.lines,
					page: 0,
					perPage: PER_PAGE,
				}),
				flags: v2EditFlags(),
			})
		} catch (error) {
			logger.error({
				method: 'PropBrowseHandler',
				event: 'props.browse.render_failed',
				token,
				error: error instanceof Error ? error.message : String(error),
			})
			await interaction.editReply({
				...notice("Couldn't load this props list. Try again."),
				flags: v2EditFlags(),
			})
		}
	}
}
