import { AccountsApi } from '@khronos-index'
import { IKH_API_CONFIG, KH_API_CONFIG } from '../KhronosInstances.js'

export default class AccountsWrapper {
	private accountsApi: AccountsApi
	private readonly khConfig: IKH_API_CONFIG = KH_API_CONFIG

	constructor() {
		this.accountsApi = new AccountsApi(this.khConfig)
	}

	async createAccount(userId: string) {
		return this.accountsApi.createAccount({ userid: userId })
	}
}
