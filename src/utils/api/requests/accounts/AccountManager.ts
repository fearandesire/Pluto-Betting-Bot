import { CommandInteraction, GuildMember } from 'discord.js'
import { ApiModules } from '../../../../lib/interfaces/api/api.interface.js'
import { ApiErrorHandler } from '../../Khronos/error-handling/ApiErrorHandler.js'
// noinspection ES6PreferShortImport
import { AccountsApi, GetBalanceDto, GetProfileDto } from '@khronos-index'
import {
	IKH_API_CONFIG,
	KH_API_CONFIG,
} from '../../Khronos/KhronosInstances.js'
import _ from 'lodash'
import GuildUtils from '../../utils/GuildUtils.js'
import EmbedsSuccess from '../../../embeds/template/success-template.js'
import MoneyFormatter from '../../common/money-formatting/money-format.js'

export class AccountsWrapper {
	private accountsApi: AccountsApi
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG

	constructor() {
		this.accountsApi = new AccountsApi(KH_API_CONFIG)
	}

	async createAccount(userid: string): Promise<any> {
		try {
			const result = await this.accountsApi.createAccount({
				userid: userid,
			})
			// Assuming createAccount method returns the created account details
			return result
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
			const res = await this.accountsApi.userProfile({
				userid: userid,
			})
			return res
		} catch (error) {
			console.error('Error retrieving account profile:', error)
			throw error // Re-throw the error after logging or handling it
		}
	}

	async processClaim(userid: string) {
		try {
			const res = await this.accountsApi.dailyClaim({
				userid: userid,
			})
			return res
		} catch (error) {
			console.error('Error processing claim:', error)
			throw error // Re-throw the error after logging or handling it
		}
	}
}

export class AccountManager {
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
				throw new Error(`No balance was resolved for user ${userId}`)
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
			const { balance, level, tier, userid } = res
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

				const embed = await new EmbedsSuccess(interaction).sv1(
					`${user?.displayName}'s Profile`,
					`💰 **Balance:** \`${formattedBalance}\`\n🛡️ **Level:** \`${level}\`\n💫 **Tier:** \`${Tier}\`\n`,
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
}
