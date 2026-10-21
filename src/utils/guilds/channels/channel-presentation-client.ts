import {
	GuildsInstance,
	KH_API_CONFIG,
} from '../../api/Khronos/KhronosInstances.js'
import {
	type ChannelPresentationReceipt,
	channelPresentationReceiptSchema,
	channelPresentationStateSchema,
} from '../../cache/data/channel-presentation-contract.js'
import { eligibleGuildData } from '../../cache/data/schemas.js'

export class ChannelPresentationClient {
	async load(guildId: string, gameId: string) {
		return channelPresentationStateSchema.parse(
			await this.request(guildId, gameId),
		)
	}

	async ack(
		guildId: string,
		gameId: string,
		receipt: ChannelPresentationReceipt,
	) {
		await this.request(
			guildId,
			gameId,
			channelPresentationReceiptSchema.parse(receipt),
		)
	}

	async guild(guildId: string) {
		const guild = await GuildsInstance.getGuildById({ id: guildId })
		const preferredTeamsValue = guild.config?.find(
			(c) => c.setting_type === 'PREFERRED_TEAMS',
		)?.setting_value
		const preferredTeams = (preferredTeamsValue ?? '')
			.split(',')
			.map((team) => team.trim())
			.filter(Boolean)
		return eligibleGuildData.parse({
			guildId,
			// V2 evaluates this game's current preferences at delivery time.
			eligibleMatches: [],
			sport: guild.sport.toLowerCase(),
			preferredTeams,
			bettingChannelId: guild.config?.find(
				(c) => c.setting_type === 'BETTING_CHAN',
			)?.setting_value,
			gameCategoryId: guild.config?.find(
				(c) => c.setting_type === 'GAMES_CATEGORY',
			)?.setting_value,
		})
	}

	private async request(
		guildId: string,
		gameId: string,
		receipt?: ChannelPresentationReceipt,
	) {
		const path = `/api/khronos/v1/internal/channel-presentations/${encodeURIComponent(guildId)}/${encodeURIComponent(gameId)}`
		const response = await (KH_API_CONFIG.fetchApi ?? fetch)(
			`${KH_API_CONFIG.basePath.replace(/\/$/, '')}${path}${receipt ? '/ack' : ''}`,
			{
				method: receipt ? 'POST' : 'GET',
				headers: {
					...KH_API_CONFIG.headers,
					Accept: 'application/json',
					...(receipt ? { 'Content-Type': 'application/json' } : {}),
				},
				...(receipt ? { body: JSON.stringify(receipt) } : {}),
				signal: AbortSignal.timeout(30_000),
			},
		)
		if (!response.ok)
			throw new Error(
				`Khronos presentation request failed (${response.status})`,
			)
		return response.status === 204 ? undefined : response.json()
	}
}
