import {
	type DateGroupDto,
	DiscordConfigSettingTypeEnum,
} from '@pluto-khronos/api-client'
import { PaginatedMessageEmbedFields } from '@sapphire/discord.js-utilities'
import { type ColorResolvable, EmbedBuilder } from 'discord.js'
import _ from 'lodash'
import { DateManager } from '../../../utils/common/DateManager.js'
import StringUtils from '../../../utils/common/string-utils.js'
import { LogType } from '../../../utils/logging/AppLog.interface.js'
import embedColors from '../../colorsConfig.js'

type Field = { name: string; value: string; inline: boolean }

/** Subset of `FooterManager.getCacheStatus()` the F1 embed reads. */
export type FooterCacheStatus = {
	lastRefresh: Date | null
	nextRefresh: Date | null
	ttl: string
	cacheSize: number
	categoryCounts: Record<string, number>
	hasAnnouncement: boolean
}

/** F1 /config footer status (owner). */
export function footerStatusEmbed(status: FooterCacheStatus) {
	const embed = new EmbedBuilder()
		.setTitle('📋 Footer Cache Status')
		.setColor(embedColors.PlutoYellow)
		.addFields(
			{
				name: '⏰ Refresh Information',
				value: `**Last Refresh:** ${status.lastRefresh ? `<t:${Math.floor(status.lastRefresh.getTime() / 1000)}:R>` : 'Never'}\n**Next Refresh:** ${status.nextRefresh ? `<t:${Math.floor(status.nextRefresh.getTime() / 1000)}:R>` : 'Unknown'}\n**TTL:** ${status.ttl}`,
				inline: false,
			},
			{
				name: '📊 Statistics',
				value: `**Total Footers:** ${status.cacheSize}\n**Categories:** ${Object.keys(status.categoryCounts).length}\n**Announcement Active:** ${status.hasAnnouncement ? '✅ Yes' : '❌ No'}`,
				inline: false,
			},
		)

	if (Object.keys(status.categoryCounts).length > 0) {
		const categoryList = Object.entries(status.categoryCounts)
			.map(([category, count]) => `• **${category}:** ${count} footers`)
			.join('\n')
		embed.addFields({
			name: '📁 Categories',
			value: categoryList,
			inline: false,
		})
	}
	return embed
}

/** F2 /config view. `defined` maps setting_type → setting_value. */
export function guildConfigViewEmbed(p: {
	guildName: string
	defined: Map<string, string>
	username: string
	avatarUrl: string
}) {
	const embed = new EmbedBuilder()
		.setColor(embedColors.info)
		.setTitle(`${p.guildName} Guild Configuration`)
		.setDescription(
			'Here are the current configuration settings for this guild.\nSet / Change using `/config set`',
		)

	for (const [key, value] of Object.entries(DiscordConfigSettingTypeEnum)) {
		const configName = StringUtils.toTitleCase(key.replace(/_/g, ' '))
		embed.addFields({
			name: configName,
			value: p.defined.get(value) || 'Not set',
		})
	}

	return embed.setAuthor({ name: p.username, iconURL: p.avatarUrl })
}

/**
 * F3/F6: Sapphire field paginator, 5 fields per page. `template` goes in the
 * message template (not `setTemplate`), so each page's colour is 'Random'.
 */
export function fieldsPaginator(template: EmbedBuilder, items: Field[]) {
	return new PaginatedMessageEmbedFields({
		template: { embeds: [template] },
	})
		.setItems(items)
		.setItemsPerPage(5)
		.make()
}

/** F3 template embed for /admin predictions view. */
export function predictionsTemplateEmbed(
	username: string,
	userId: string,
	count: number,
) {
	return new EmbedBuilder()
		.setTitle(`Active Predictions | ${username}`)
		.setDescription(`Total: \`${count}\` active prediction(s)`)
		.setColor(embedColors.PlutoBlue)
		.setFooter({ text: `User ID: ${userId}` })
}

/** F3 one paginated field. `match` and `date` are already resolved. */
export function predictionField(p: {
	id: string
	choice: string
	point?: number
	marketKey: string
	outcomeDescription?: string
	match: string
	date: string
}): Field {
	const marketName = _.startCase(p.marketKey.replace('player_', ''))
	const upperChoice = p.choice.toUpperCase()
	const formattedChoice =
		p.point !== null && p.point !== undefined
			? `${upperChoice} ${p.point} ${marketName}`
			: `${upperChoice} ${marketName}`

	let propDetailsValue = `**Choice:** ${formattedChoice}`
	if (p.outcomeDescription && p.outcomeDescription.trim() !== '') {
		propDetailsValue = `**Prop:** ${p.outcomeDescription}\n${propDetailsValue}`
	}
	const eventDetailsValue = `**Match:** ${p.match}\n**Date:** ${p.date}`
	const shortId = p.id.slice(-8)

	return {
		name: `Prediction #${shortId}`,
		value: `**ID:** \`${shortId}\`\n\n**Prop Details**\n${propDetailsValue}\n\n**Event Details**\n${eventDetailsValue}`,
		inline: false,
	}
}

/** F4 /admin predictions delete confirmation. */
export function predictionDeletedEmbed(p: {
	id: string
	username: string
	userId: string
	match: string
	choice: string
	date: string
}) {
	return new EmbedBuilder()
		.setTitle('✅ Prediction Deleted')
		.setColor(embedColors.success)
		.setDescription(`Successfully deleted prediction for ${p.username}.`)
		.addFields(
			{
				name: 'Prediction ID',
				value: `\`${p.id.slice(-8)}\``,
				inline: true,
			},
			{
				name: 'User',
				value: `${p.username} (${p.userId})`,
				inline: true,
			},
			{ name: 'Match', value: p.match, inline: false },
			{ name: 'Choice', value: p.choice, inline: true },
			{ name: 'Created', value: p.date, inline: true },
		)
		.setTimestamp()
}

/** F5 /admin props generate final state. `channel` is the channel mention. */
export function propsPostedEmbed(
	result: { total: number; posted: number; failed: number },
	channel: string,
) {
	const responseLines: string[] = [
		`✅ Successfully posted **${result.posted}** player prop${result.posted !== 1 ? 's' : ''} to ${channel}`,
	]
	if (result.failed > 0) {
		responseLines.push(
			`❌ Failed to post **${result.failed}** prop${result.failed !== 1 ? 's' : ''}`,
		)
	}

	return new EmbedBuilder()
		.setTitle('Player Props Posted')
		.setDescription(responseLines.join('\n'))
		.setColor(embedColors.PlutoGreen)
		.addFields(
			{
				name: 'Total Pairs',
				value: result.total.toString(),
				inline: true,
			},
			{ name: 'Posted', value: result.posted.toString(), inline: true },
			{ name: 'Failed', value: result.failed.toString(), inline: true },
		)
		.setTimestamp()
}

/** F6 /admin props viewactive header embed. */
export function activePropsEmbed(totalOutcomes: number, dateCount: number) {
	return new EmbedBuilder()
		.setTitle('Active Props - Pending Results')
		.setDescription(
			`Found **${totalOutcomes}** outcome${totalOutcomes !== 1 ? 's' : ''} with active predictions across **${dateCount}** date${dateCount !== 1 ? 's' : ''}.\nManage prop results in the Khronos admin dashboard.`,
		)
		.setColor(embedColors.PlutoBlue)
		.setTimestamp()
}

/** F6 fields: a date header, then each game and its props. */
export function activePropsFields(dateGroups: DateGroupDto[]): Field[] {
	const fields: Field[] = []

	for (const dateGroup of dateGroups) {
		const formattedDate = new Date(dateGroup.date).toLocaleDateString(
			'en-US',
			{
				weekday: 'short',
				month: 'short',
				day: 'numeric',
				year: 'numeric',
			},
		)
		fields.push({
			name: `​\n📅 ${formattedDate}`,
			value: '​',
			inline: false,
		})

		for (const game of dateGroup.games) {
			const gameTime = new DateManager().toDiscordUnix(game.commence_time)
			const gameTotalPredictions = game.props.reduce(
				(sum, prop) => sum + prop.prediction_count,
				0,
			)
			fields.push({
				name: `🎯 ${game.matchup}`,
				value: `Time: ${gameTime} • ${gameTotalPredictions} prediction${gameTotalPredictions !== 1 ? 's' : ''}`,
				inline: false,
			})

			for (const prop of game.props) {
				const propParts: string[] = [
					`**Market:** ${StringUtils.toTitleCase(prop.market_key.replace(/_/g, ' '))}`,
				]
				if (prop.description) {
					propParts.push(`**Player:** ${prop.description}`)
				}
				if (prop.point !== null && prop.point !== undefined) {
					propParts.push(`**Line:** ${prop.point}`)
				}
				propParts.push(`**Predictions:** ${prop.prediction_count}`)
				fields.push({
					name: `  └ 🎯 ${prop.outcome_uuid}`,
					value: `  ${propParts.join(' • ')}`,
					inline: false,
				})
			}
		}
	}
	return fields
}

export const logTypeColors: Record<LogType, ColorResolvable> = {
	[LogType.Error]: embedColors.error,
	[LogType.Info]: embedColors.info,
	[LogType.Warning]: embedColors.warning,
	[LogType.Success]: embedColors.success,
}

/** F7 AppLog embed posted to the guild log channel. */
export function appLogEmbed(
	description: string,
	type: LogType,
	avatarUrl: string | null,
) {
	return new EmbedBuilder()
		.setDescription(description)
		.setColor(logTypeColors[type])
		.setAuthor({ name: 'Pluto', iconURL: avatarUrl })
		.setTimestamp()
}
