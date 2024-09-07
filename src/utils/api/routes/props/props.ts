import Router from "koa-router";
import { GuildChannelArraySchema, type PropRaw } from "./props-route.interface.js";
import PropEmbedManager from "../../../../utils/guilds/prop-embeds/PropEmbedManager.js";
import { PropArraySchema } from "@pluto-api-interfaces";

const PropsRouter = new Router()

interface RequestBody {
	props: PropRaw[]
	guildChannels: { guild_id: string; prop_channel_id: string }[]
}

/**
 * @route POST /props/daily
 * @description Receives an array of Props and channel IDs on a daily schedule
 * @param {Prop[]} props - Array of Prop objects
 * @param {Object[]} guildChannels - Array of guild and channel objects
 */
PropsRouter.post('/props/daily', async (ctx) => {
	const { props, guildChannels } = ctx.request.body as RequestBody

	// Validate the received props using Zod
	const result = PropArraySchema.safeParse(props)
	if (!result.success) {
		ctx.status = 400
		ctx.body = {
			message: 'Invalid prop received',
			errors: result.success ? [] : result.error.errors,
		}
		return
	}

	// Validate guildChannels
	const guildChannelsResult = GuildChannelArraySchema.safeParse(guildChannels)
	if (!guildChannelsResult.success) {
		ctx.status = 400
		ctx.body = {
			message: 'Invalid guild channel data received',
			errors: guildChannelsResult.error.errors,
		}
		return
	}

	// Pass props and guildChannels to PropEmbedManager
	const embedManager = new PropEmbedManager()
	await embedManager.createEmbeds(props, guildChannels)

	ctx.status = 200
	ctx.body = { message: 'Props received successfully', props: result.data }
})

export default PropsRouter
