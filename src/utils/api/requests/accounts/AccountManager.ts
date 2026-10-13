import {
	type Account,
	AccountsApi,
	type GetBalanceDto,
	type GetLeaderboardDto,
	type GetProfileDto,
} from '@pluto-khronos/api-client'
import type { CommandInteraction, GuildMember } from 'discord.js'
import _ from 'lodash'
import { profileDescription } from '../../../../lib/discord/builders/account.js'
import { ApiModules } from '../../../../lib/interfaces/api/api.interface.js'
import { supportMessage } from '../../../../lib/PlutoConfig.js'
import { ErrorEmbeds } from '../../../common/errors/global.js'
import { isMockEnabled, MockBackend } from '../../../dev/index.js'
import PaginationUtilities from '../../../embeds/pagination-utilities.js'
import EmbedsSuccess from '../../../embeds/template/success-template.js'
import { resolveLeaderboardMembers } from '../../../guilds/member-resolver.js'
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
	private mock?: MockBackend

	constructor() {
		this.accountsApi = new AccountsApi(this.khConfig)
		if (isMockEnabled()) this.mock = MockBackend.instance()
	}

	async createAccount(userid: string): Promise<Account> {
		if (this.mock) return this.mock.createAccount(userid)
		return await this.accountsApi.createAccount({
			userid: userid,
		})
	}

	async getAccountBalance(userid: string): Promise<Partial<GetBalanceDto>> {
		if (this.mock) return this.mock.getAccountBalance(userid)
		const res = await this.accountsApi.getBalance({
			userid: userid,
		})
		return { balance: res.balance, userid: userid }
	}

	async getProfile(userid: string): Promise<GetProfileDto> {
		if (this.mock) return this.mock.getProfile(userid)
		return await this.accountsApi.userProfile({
			userid: userid,
		})
	}

	async processClaim(userid: string, patreonOverride: boolean) {
		if (this.mock) return this.mock.processClaim(userid)
		const data = {
			userid: userid,
			dailyClaimBodyDto: {
				patreonOverride: patreonOverride,
			},
		}
		return await this.accountsApi.dailyClaim(data)
	}

	async getLeaderboard(): Promise<GetLeaderboardDto[]> {
		if (this.mock) return this.mock.getLeaderboard()
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
				'ðŸ’° Processed Daily Claim',
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
				const member =
					interaction.guild.members.cache.get(userid) ??
					(await interaction.guild.members
						.fetch(userid)
						.catch(() => null))
				const user =
					member?.user ??
					(userid === interaction.user.id
						? interaction.user
						: await interaction.client.users
								.fetch(userid)
								.catch(() => null))
				const displayName =
					member?.displayName ??
					user?.globalName ??
					user?.username ??
					userid
				const formattedBalance = MoneyFormatter.toUSD(balance)
				const Tier = _.upperFirst(tier)
				const descStr = profileDescription({
					balance: formattedBalance,
					level,
					tier: Tier,
					welcome: isNewUser ? plutoWelcomeMsg : undefined,
				})
				const embed = await EmbedsSuccess.sv1(
					interaction,
					`${displayName}'s Profile`,
					descStr,
				)
				return interaction.editReply({ embeds: [embed] })
			}
		} catch (error) {
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
			const guild = currentGuild
			// Resolve current dsicord usernames
			const lbData = res.map((user: any) => ({
				userid: user.id,
				balance: `${Number(user.balance).toFixed(2)}`,
			}))
			const lbMembers = await resolveLeaderboardMembers(
				guild,
				lbData.map((entry) => entry.userid),
			)
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
