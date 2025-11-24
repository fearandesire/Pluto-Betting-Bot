import {
	AccountsApi,
	type GetBalanceDto,
	type GetLeaderboardDto,
	type GetProfileDto,
} from '@kh-openapi'
import type { CommandInteraction, GuildMember } from 'discord.js'
import _ from 'lodash'
import { SapDiscClient } from '../../../../index.js'
import { ApiModules } from '../../../../lib/interfaces/api/api.interface.js'
import { supportMessage } from '../../../../lib/PlutoConfig.js'
import { ErrorEmbeds } from '../../../common/errors/global.js'
import PaginationUtilities from '../../../embeds/pagination-utilities.js'
import EmbedsSuccess from '../../../embeds/template/success-template.js'
import GuildUtils from '../../../guilds/GuildUtils.js'
import { handleNewUser } from '../../common/handleNewUser.js'
import { plutoWelcomeMsg } from '../../common/interfaces/kh-pluto/kh-pluto.interface.js'
import MoneyFormatter from '../../common/money-formatting/money-format.js'
import { ApiErrorHandler } from '../../Khronos/error-handling/ApiErrorHandler.js'
import {
	type IKH_API_CONFIG,
	KH_API_CONFIG,
} from '../../Khronos/KhronosInstances.js'
import PatreonFacade from '../../patreon/Patreon-Facade.js'

export class AccountsWrapper {
	private accountsApi: AccountsApi
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG

	constructor() {
		this.accountsApi = new AccountsApi(this.khConfig)
	}

	async createAccount(userid: string): Promise<any> {
		// Assuming createAccount method returns the created account details
		return await this.accountsApi.createAccount({
			userid: userid,
		})
	}

	async getAccountBalance(userid: string): Promise<Partial<GetBalanceDto>> {
		const res = await this.accountsApi.getBalance({
			userid: userid,
		})
		return { balance: res.balance, userid: userid }
	}

	async getProfile(userid: string): Promise<GetProfileDto> {
		return await this.accountsApi.userProfile({
			userid: userid,
		})
	}

	async processClaim(userid: string, patreonOverride: boolean) {
		const data = {
			userid: userid,
			dailyClaimBodyDto: {
				patreonOverride: patreonOverride,
			},
		}
		return await this.accountsApi.dailyClaim(data)
	}

	async getLeaderboard(): Promise<GetLeaderboardDto[]> {
		return await this.accountsApi.getLeaderboard()
	}
}

export class AccountManager {
	private paginationUtilities = new PaginationUtilities()
	constructor(private accountsWrapper: AccountsWrapper) {}

	/**
	 * To encourage users to bet for player progression, `balance` requests will redirect to `profile`
	 * @param interaction
	 * @param targetId
	 */

	async getBalance(interaction: CommandInteraction, targetId: string) {
		return this.fetchProfile(interaction, targetId)
	}

	async claim(interaction: CommandInteraction) {
		const userId = interaction.user.id
		try {
			const patreonOverride = await PatreonFacade.isSupporterTier(userId)
			const res = await this.accountsWrapper.processClaim(
				userId,
				patreonOverride,
			)
			const { balance } = res
			if (!balance) {
				const errEmbed = await ErrorEmbeds.accountErr(
					`Unable to locate your account's balance.\n${supportMessage}`,
				)
				return interaction.editReply({ embeds: [errEmbed] })
			}
			const formattedBalance = MoneyFormatter.toUSD(balance)
			const descStr = `Your balance is **\`${formattedBalance}\`**`
			const embed = await EmbedsSuccess.sv1(
				interaction,
				'💰 Processed Daily Claim',
				descStr,
			)
			return interaction.editReply({ embeds: [embed] })
		} catch (error) {
			return await new ApiErrorHandler().handle(
				interaction,
				error,
				ApiModules.account,
			)
		}
	}
	async fetchProfile(interaction: CommandInteraction, targetId: string) {
		try {
			const res = await this.accountsWrapper.getProfile(targetId)
			handleNewUser(res)
			const { balance, level, tier, userid, isNewUser } = res
			if (interaction.guild) {
				const guildUtils = new GuildUtils()
				const guild = await guildUtils.getGuild(interaction.guild.id)
				if (!guild) {
					throw new Error('Guild not identified from interaction.')
				}
				const user: GuildMember | undefined = await guildUtils.getUser(
					guild,
					userid,
				)
				const userAvatar = user?.displayAvatarURL()
				if (!userAvatar) {
					throw new Error('User avatar not found.')
				}
				const formattedBalance = MoneyFormatter.toUSD(balance)
				const Tier = _.upperFirst(tier)
				let descStr = ''
				if (isNewUser) {
					descStr += `${plutoWelcomeMsg}\n\n💰 **Balance:** \`${formattedBalance}\`\n🛡️ **Level:** \`${level}\`\n💫 **Tier:** \`${Tier}\``
				} else {
					descStr = `💰 **Balance:** \`${formattedBalance}\`\n🛡️ **Level:** \`${level}\`\n💫 **Tier:** \`${Tier}\``
				}
				const embed = await EmbedsSuccess.sv1(
					interaction,
					`${user?.displayName}'s Profile`,
					descStr,
				)
				return interaction.editReply({ embeds: [embed] })
			}
		} catch (error) {
			console.error({
				source: 'AccountManager.fetchProfile',
				message: 'Error fetching profile',
				error: error,
				targetId,
			})
			return await new ApiErrorHandler().handle(
				interaction,
				error,
				ApiModules.account,
			)
		}
	}

	async getLeaderboardData(interaction: CommandInteraction) {
		try {
			const res = await this.accountsWrapper.getLeaderboard()
			const currentGuild = interaction.guild
			if (!currentGuild) {
				throw new Error('Guild not identified from interaction.')
			}
			const guild = await SapDiscClient.guilds.fetch(interaction.guild.id)
			// Resolve current dsicord usernames
			const lbData = res.map((user: any) => ({
				userid: user.id,
				balance: `${Number(user.balance).toFixed(2)}`,
			}))
			// Pre-fetch all members
			const lbUserIds = lbData.map((entry: any) => entry.userid)
			const lbMembers = await guild.members.fetch({
				user: lbUserIds,
			})
			// Map lbData to include Discord member details
			const formattedLbData = lbData.map((entry: any) => {
				const member: GuildMember | undefined = lbMembers.get(
					entry.userid,
				)
				return {
					...entry,
					memberTag:
						member?.user.tag ??
						member?.displayName ??
						`<@${entry.userid}>`,
				}
			})
			return this.paginationUtilities.displayLeaderboardPage(
				interaction,
				formattedLbData,
				1,
			)
		} catch (error) {
			return await new ApiErrorHandler().handle(
				interaction,
				error,
				ApiModules.account,
			)
		}
	}
}
