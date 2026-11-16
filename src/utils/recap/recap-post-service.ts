import type { TextChannel } from 'discord.js'
import { periodWinnersPayload } from '../../lib/discord/builders/period-winners.js'
import { weeklyRecapPayload } from '../../lib/discord/builders/weekly-recap.js'
import type RecapWrapper from '../api/Khronos/recap/recap-wrapper.js'
import type { RecapSport } from '../api/Khronos/recap/recap-wrapper.js'
import {
	type DeliveryChannelResolver,
	resolveDeliveryChannel,
} from '../cron/delivery.js'

export const RECAP_POST_TYPES = ['weekly', 'monthly'] as const
export type RecapPostType = (typeof RECAP_POST_TYPES)[number]

export const RECAP_POST_SPORTS = ['nfl', 'nba'] as const

export interface RecapPostRequest {
	guildId: string
	channelId: string
	type: RecapPostType
	sport: RecapSport
}

export interface RecapPostResult {
	channel_id: string
	message_id: string
}

/**
 * Delivers one staff-triggered recap. Auto-posts stay in the cron services;
 * this path is the shared worker behind `/recap post` and Khronos's
 * `POST /recap/post` receiver.
 */
export class RecapPostService {
	constructor(
		private readonly recapApi: Pick<
			RecapWrapper,
			'getWeeklyRecap' | 'getPeriodWinners'
		>,
		private readonly channelResolver: DeliveryChannelResolver,
	) {}

	async post(request: RecapPostRequest): Promise<RecapPostResult> {
		const channel = await resolveDeliveryChannel(
			this.channelResolver,
			request.guildId,
			request.channelId,
			'recap_post',
		)

		if (request.type === 'weekly') {
			const recap = await this.recapApi.getWeeklyRecap(
				request.guildId,
				0,
				request.sport,
			)
			const message = await channel.send(
				weeklyRecapPayload(recap, request.sport),
			)
			return { channel_id: channel.id, message_id: message.id }
		}

		const winners = await this.recapApi.getPeriodWinners({
			guildId: request.guildId,
			sport: request.sport,
			period: 'monthly',
			// -1 is the closed month, the same period the scheduled post uses.
			periodOffset: -1,
		})
		if (winners.winners.length === 0) {
			throw new Error('There are no monthly winners to post yet')
		}
		const message = await channel.send(periodWinnersPayload(winners))
		return { channel_id: channel.id, message_id: message.id }
	}
}

/** Resolver that never falls back to a different channel for a staff post. */
export const explicitChannelResolver: DeliveryChannelResolver = {
	async getBettingChannel(): Promise<TextChannel> {
		throw new Error('A recap post requires an explicit channel')
	},
}
