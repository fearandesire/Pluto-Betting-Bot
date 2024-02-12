import { AxiosKhronosInstance } from '../../common/axios-config.js'
import { CommandInteraction, EmbedBuilder } from 'discord.js'
import { ApiModules } from '../../../../lib/interfaces/api/api.interface.js'
import { ApiErrorHandler } from '../../common/ApiErrorHandler.js'
import { helpfooter } from '@pluto-core-config'
import embedColors from '../../../../lib/colorsConfig.js'
import { IProfileArgs } from './account-interface'
import KhronosReqHandler from '../../common/KhronosReqHandler'

export class AccountManager {
	private readonly axiosKhronosInstance = AxiosKhronosInstance

	constructor(private khronosReqHandler: KhronosReqHandler) {}

	async processClaim(interaction: CommandInteraction) {
		const userId = interaction.user.id
		try {
			const claimQuery =
				await this.khronosReqHandler.postDailyClaim(userId)
			if (claimQuery.data.statusCode === 200) {
				const successfulClaimEmbed = new EmbedBuilder()
					.setTitle('Daily Claim')
					.setDescription('Your daily claim has been processed!')
					.setColor(embedColors.success)
					.setFooter({
						text: helpfooter,
					})
				return interaction.editReply({
					embeds: [successfulClaimEmbed],
				})
			} else {
				throw new Error(`Unknown error`)
			}
		} catch (error) {
			console.error(error)
			return new ApiErrorHandler().handle(
				interaction,
				error,
				ApiModules.account,
			)
		}
	}
	async fetchProfile(interaction: CommandInteraction, args: IProfileArgs) {
		try {
			const profile = await this.khronosReqHandler.fetchUserProfile(
				args.targetUserId,
			)
			if (profile.data.statusCode === 200) {
				const { data } = profile
				const { balance, level, tier } = data
				const username = args.targetUsername
				const balanceEmbed = new EmbedBuilder()
					.setTitle(`${username}'s Profile`)
					.setDescription(
						`💰 **Balance:** \`${balance}\`\n🛡️ **Level:** \`${level}\`\n💫 **Tier:** \`${tier}\``,
					)
					.setColor(embedColors.success)
					.setFooter({ text: helpfooter })
				return interaction.followUp({ embeds: [balanceEmbed] })
			}
		} catch (error) {
			return new ApiErrorHandler().handle(
				interaction,
				error,
				ApiModules.account,
			)
		}
	}
}
