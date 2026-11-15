import { randomBytes } from 'node:crypto'
import { container } from '@sapphire/framework'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import { MessageFlags } from 'discord.js'
import {
	propPickerNotice,
	propPickerPayload,
} from '../../lib/discord/builders/prop-picker.js'
import PropsApiWrapper from '../api/Khronos/props/props-api-wrapper.js'
import { logger } from '../logging/WinstonLogger.js'
import { PropPickerService } from '../props/PropPickerService.js'
import { savePropPickerSession } from '../props/PropPickerStore.js'

/**
 * `/admin props pick` opens a private, filterable picker over the full
 * available slate. It posts through Khronos's curated-post endpoint, so the
 * ledger, deduplication and pairing rules are the daily autopost's.
 */
export class AdminPropPickerHandler {
	constructor(
		private readonly service = new PropPickerService(new PropsApiWrapper()),
	) {}

	public async handle(
		interaction: Subcommand.ChatInputCommandInteraction,
	): Promise<void> {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral })
		try {
			if (!interaction.guildId) {
				await interaction.editReply(
					propPickerNotice('Run this command inside a server.'),
				)
				return
			}
			const sport = interaction.options.getString('sport', true)
			if (sport !== 'nba' && sport !== 'nfl') {
				await interaction.editReply(
					propPickerNotice('Pick NBA or NFL props.'),
				)
				return
			}
			const token = randomBytes(8).toString('hex')
			const session = await this.service.start({
				token,
				userId: interaction.user.id,
				guildId: interaction.guildId,
				sport,
				filters: {
					game: interaction.options.getString('game') ?? '',
					category: interaction.options.getString('category') ?? '',
					player: interaction.options.getString('player') ?? '',
				},
			})
			if (session.pairs.length === 0) {
				await interaction.editReply(
					propPickerNotice(
						'No props match those filters right now. Run the command again with different filters.',
					),
				)
				return
			}
			if (!(await savePropPickerSession(token, session))) {
				await interaction.editReply(
					propPickerNotice(
						'The picker could not save its state. Try again.',
					),
				)
				return
			}
			await interaction.editReply(propPickerPayload(session))
			logger.info({
				method: 'AdminPropPickerHandler',
				event: 'props.pick.opened',
				userId: interaction.user.id,
				guildId: interaction.guildId,
				sport,
				pairs: session.pairs.length,
				filters: session.filters,
			})
		} catch (error) {
			container.logger.error(error)
			logger.error({
				method: 'AdminPropPickerHandler',
				event: 'props.pick.open_failed',
				userId: interaction.user.id,
				error: error instanceof Error ? error.message : String(error),
			})
			try {
				await interaction.editReply(
					propPickerNotice(
						"Couldn't load the props picker. Try again.",
					),
				)
			} catch {
				// The interaction token is gone; nothing left to tell the user.
			}
		}
	}
}
