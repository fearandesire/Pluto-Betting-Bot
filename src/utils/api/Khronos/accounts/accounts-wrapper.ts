import { AccountsApi, Account } from '@kh-openapi/index.js'
import { IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js'

export default class AccountsWrapper {
	private accountsApi: AccountsApi
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG

	constructor() {
		this.accountsApi = new AccountsApi(this.khConfig)
	}

	async createAccount(userId: string): Promise<Account> {
		return this.accountsApi.createAccount({ userid: userId })
	}
}
