import {
	InteractionHandler,
	InteractionHandlerTypes,
} from '@sapphire/framework'
import type { Interaction, MessageComponentInteraction } from 'discord.js'
import {
	decodePropPickerId,
	type PropPickerAction,
	propPickerNotice,
	propPickerPayload,
	propPickerPostedPayload,
	propPickerPreviewPayload,
} from '../lib/discord/builders/prop-picker.js'
import { v2EditFlags } from '../lib/discord/v2/kit.js'
import PropsApiWrapper from '../utils/api/Khronos/props/props-api-wrapper.js'
import { logger } from '../utils/logging/WinstonLogger.js'
import {
	PROP_PICKER_MAX_SELECTED,
	paginatePropPickerPairs,
	selectedPropPickerPairs,
} from '../utils/props/PropPicker.js'
import { PropPickerService } from '../utils/props/PropPickerService.js'
import {
	clearPropPickerSession,
	loadPropPickerSession,
	type PropPickerSession,
	savePropPickerSession,
} from '../utils/props/PropPickerStore.js'

type Route = { action: PropPickerAction; token: string }

/**
 * Routes the picker's select menu and buttons. Selection state lives in Redis
 * under the token, so page turns and price checks never lose a pick.
 */
export class PropPickerHandler extends InteractionHandler {
	private readonly service = new PropPickerService(new PropsApiWrapper())

	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.MessageComponent,
		})
	}

	public override parse(interaction: Interaction) {
		if (!interaction.isMessageComponent()) return this.none()
		const route = decodePropPickerId(interaction.customId)
		return route ? this.some(route) : this.none()
	}

	public override async run(
		interaction: Interaction,
		route: Route,
	): Promise<void> {
		if (!interaction.isMessageComponent()) return
		const session = await loadPropPickerSession(route.token)
		if (!session) {
			await interaction.reply(
				propPickerNotice(
					'This picker expired. Run `/admin props pick` again.',
				),
			)
			return
		}
		if (session.userId !== interaction.user.id) {
			await interaction.reply(
				propPickerNotice(
					'Only the admin who opened this picker can use it.',
				),
			)
			return
		}
		try {
			switch (route.action) {
				case 'select':
					await this.handleSelect(interaction, session, route.token)
					return
				case 'prev':
					await this.changePage(interaction, session, -1, route.token)
					return
				case 'next':
					await this.changePage(interaction, session, 1, route.token)
					return
				case 'clear':
					await this.clear(interaction, session, route.token)
					return
				case 'preview':
					await interaction.reply(propPickerPreviewPayload(session))
					return
				case 'post':
					await this.post(interaction, session, route.token)
					return
			}
		} catch (error) {
			logger.error({
				method: 'PropPickerHandler',
				event: 'props.pick.interaction_failed',
				action: route.action,
				userId: interaction.user.id,
				error: error instanceof Error ? error.message : String(error),
			})
			const notice = propPickerNotice(
				"Couldn't update the picker. Try again.",
			)
			if (interaction.deferred || interaction.replied) {
				await interaction.followUp(notice).catch(() => undefined)
			} else {
				await interaction.reply(notice).catch(() => undefined)
			}
		}
	}

	private async handleSelect(
		interaction: MessageComponentInteraction,
		session: PropPickerSession,
		token: string,
	): Promise<void> {
		if (!interaction.isStringSelectMenu()) return
		await interaction.deferUpdate()
		const page = paginatePropPickerPairs(session.pairs, session.page)
		const pageKeys = new Set(page.items.map((pair) => pair.key))
		const picked = new Set(
			interaction.values
				.map((value) => page.items[Number(value)]?.key)
				.filter((key): key is string => key !== undefined),
		)
		const next = [
			...session.selected.filter((key) => !pageKeys.has(key)),
			...picked,
		]
		session.selected = next.slice(0, PROP_PICKER_MAX_SELECTED)
		if (!(await this.persist(interaction, token, session))) return
		await interaction.editReply({
			...propPickerPayload(
				session,
				next.length > PROP_PICKER_MAX_SELECTED
					? `Only ${PROP_PICKER_MAX_SELECTED} props fit in one post. The extras were left unselected.`
					: undefined,
			),
			flags: v2EditFlags(),
		})
	}

	private async changePage(
		interaction: MessageComponentInteraction,
		session: PropPickerSession,
		delta: number,
		token: string,
	): Promise<void> {
		await interaction.deferUpdate()
		const last = paginatePropPickerPairs(session.pairs, session.page)
		const target = Math.min(Math.max(0, last.page + delta), last.pages - 1)
		session.page = target
		if (!(await this.persist(interaction, token, session))) return
		await interaction.editReply({
			...propPickerPayload(session),
			flags: v2EditFlags(),
		})
	}

	private async clear(
		interaction: MessageComponentInteraction,
		session: PropPickerSession,
		token: string,
	): Promise<void> {
		await interaction.deferUpdate()
		session.selected = []
		if (!(await this.persist(interaction, token, session))) return
		await interaction.editReply({
			...propPickerPayload(session),
			flags: v2EditFlags(),
		})
	}

	/** Saves the session; on failure tells the admin and leaves the message as is. */
	private async persist(
		interaction: MessageComponentInteraction,
		token: string,
		session: PropPickerSession,
	): Promise<boolean> {
		if (await savePropPickerSession(token, session)) return true
		await interaction
			.followUp(
				propPickerNotice(
					"Couldn't save your picks, so nothing changed. Try again.",
				),
			)
			.catch(() => undefined)
		return false
	}

	private async post(
		interaction: MessageComponentInteraction,
		session: PropPickerSession,
		token: string,
	): Promise<void> {
		if (session.selected.length === 0) {
			await interaction.reply(
				propPickerNotice('Select at least one prop first.'),
			)
			return
		}
		await interaction.deferUpdate()
		await interaction.editReply({
			...propPickerNotice('Checking prices before posting…'),
			flags: v2EditFlags(),
		})
		let recheck
		try {
			recheck = await this.service.recheck(session)
		} catch {
			await interaction.editReply({
				...propPickerPayload(
					session,
					"Couldn't check prices. Nothing was posted; try again.",
				),
				flags: v2EditFlags(),
			})
			return
		}
		if (recheck.changes.length > 0 || recheck.missing.length > 0) {
			const missing = new Set(recheck.missing.map((pair) => pair.key))
			session.selected = session.selected.filter(
				(key) => !missing.has(key),
			)
			session.prices = recheck.prices
			if (!(await this.persist(interaction, token, session))) {
				await interaction.editReply({
					...propPickerPayload(session),
					flags: v2EditFlags(),
				})
				return
			}
			const parts: string[] = []
			const missingKeys = new Set(recheck.missing.map((pair) => pair.key))
			const moved = recheck.changes.filter(
				(change) => !missingKeys.has(change.key),
			)
			if (moved.length > 0) {
				const labels = moved
					.slice(0, 3)
					.map((change) => change.label)
					.join(', ')
				parts.push(
					`Prices moved for ${moved.length} prop${moved.length === 1 ? '' : 's'}: ${labels}. Review the prices, then press Post again.`,
				)
			}
			if (recheck.missing.length > 0) {
				parts.push(
					`${recheck.missing.length} prop${recheck.missing.length === 1 ? ' is' : 's are'} no longer quoted and were removed.`,
				)
			}
			await interaction.editReply({
				...propPickerPayload(session, parts.join(' ')),
				flags: v2EditFlags(),
			})
			return
		}
		let result
		try {
			result = await this.service.post(session)
		} catch (error) {
			logger.error({
				method: 'PropPickerHandler',
				event: 'props.pick.post_failed',
				userId: interaction.user.id,
				error: error instanceof Error ? error.message : String(error),
			})
			await interaction.editReply({
				...propPickerPayload(
					session,
					"Couldn't post the props. Check the channel before trying again.",
				),
				flags: v2EditFlags(),
			})
			return
		}
		await clearPropPickerSession(token)
		await interaction.editReply({
			...propPickerPostedPayload(result),
			flags: v2EditFlags(),
		})
	}
}
