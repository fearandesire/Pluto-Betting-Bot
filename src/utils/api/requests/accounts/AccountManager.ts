import { CommandInteraction, GuildMember } from 'discord.js'
import { ApiModules } from '../../../../lib/interfaces/api/api.interface.js'
import { ApiErrorHandler } from '../../Khronos/error-handling/ApiErrorHandler.js'
import {
	AccountsApi,
	GetBalanceDto,
	GetLeaderboardDto,
	GetProfileDto,
} from '@khronos-index'
import {
	IKH_API_CONFIG,
	KH_API_CONFIG,
} from '../../Khronos/KhronosInstances.js'
import _ from 'lodash'
import GuildUtils from '../../../guilds/GuildUtils.js'
import EmbedsSuccess from '../../../embeds/template/success-template.js'
import MoneyFormatter from '../../common/money-formatting/money-format.js'
import { SapDiscClient } from '@pluto-core'
import PaginationUtilities from '../../../embeds/pagination-utilities.js'

export class AccountsWrapper {
	private accountsApi: AccountsApi
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG

	constructor() {
		this.accountsApi = new AccountsApi(this.khConfig)
	}

	async createAccount(userid: string): Promise<any> {
		try {
			// Assuming createAccount method returns the created account details
			return await this.accountsApi.createAccount({
				userid: userid,
			})
		} catch (error) {
			console.error('Error creating account:', error)
			throw error // Re-throw the error after logging or handling it
		}
	}

	async getAccountBalance(userid: string): Promise<Partial<GetBalanceDto>> {
		try {
			const res = await this.accountsApi.getBalance({
				userid: userid,
			})
			return { balance: res.balance, userid: userid }
		} catch (error) {
			console.error('Error retrieving account balance:', error)
			throw error // Re-throw the error after logging or handling it
		}
	}

	async getProfile(userid: string): Promise<GetProfileDto> {
		try {
			return await this.accountsApi.userProfile({
				userid: userid,
			})
		} catch (error) {
			console.error('Error retrieving account profile:', error)
			throw error // Re-throw the error after logging or handling it
		}
	}

	async processClaim(userid: string) {
		try {
			return await this.accountsApi.dailyClaim({
				userid: userid,
			})
		} catch (error) {
			console.error('Error processing claim:', error)
			throw error // Re-throw the error after logging or handling it
		}
	}

	async getLeaderboard(): Promise<GetLeaderboardDto[]> {
		try {
			return await this.accountsApi.getLeaderboard()
		} catch (error) {
			console.error('Error retrieving leaderboard:', error)
			throw error // Re-throw the error after logging or handling it
		}
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
			const res = await this.accountsWrapper.processClaim(userId)
			const { balance } = res
			if (!balance) {
				throw new Error(`Failed to resolve your balance.`)
			}
			const formattedBalance = MoneyFormatter.toUSD(balance)
			const embed = await new EmbedsSuccess(interaction).sv1(
				`Processed Daily Claim`,
				`Successfully processed your daily claim.\nYour new balance is **\`${formattedBalance}\`**`,
			)
			return interaction.editReply({ embeds: [embed] })
		} catch (error) {
			return new ApiErrorHandler().handle(
				interaction,
				error,
				ApiModules.account,
			)
		}
	}
	async fetchProfile(interaction: CommandInteraction, targetId: string) {
		try {
			const res = await this.accountsWrapper.getProfile(targetId)
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
					descStr += `Welcome to Pluto!\n👁️ View games to bet on using \`/odds\`\n✅ Place bets using \`/bet\`\nFind out what other things you can do via \`commands\`\n💰 **Balance:** \`${formattedBalance}\`\n🛡️ **Level:** \`${level}\`\n💫 **Tier:** \`${Tier}\``
				} else {
					descStr = `💰 **Balance:** \`${formattedBalance}\`\n🛡️ **Level:** \`${level}\`\n💫 **Tier:** \`${Tier}\``
				}
				const embed = await new EmbedsSuccess(interaction).sv1(
					`${user?.displayName}'s Profile`,
					descStr,
				)
				return interaction.editReply({ embeds: [embed] })
			}
		} catch (error) {
			return new ApiErrorHandler().handle(
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
				balance: user.balance,
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
					memberTag: member?.user.tag ?? `<@${entry.userid}>`,
				}
			})
			return this.paginationUtilities.displayLeaderboardPage(
				interaction,
				formattedLbData,
				1,
			)
		} catch (error) {
			return new ApiErrorHandler().handle(
				interaction,
				error,
				ApiModules.account,
			)
		}
	}
}
