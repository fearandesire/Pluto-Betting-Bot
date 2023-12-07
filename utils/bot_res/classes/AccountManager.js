import { db } from '#db'

export default class AccountManager {
	constructor(accountTable) {
		this.accountTable = accountTable
	}

	async getBalance(userId) {
		return db.oneOrNone(
			`SELECT balance FROM "${this.accountTable}" WHERE userid = $1`,
			[userId],
		)
	}

	async getAll() {
		return db.manyOrNone(
			`SELECT * FROM "${this.accountTable}"`,
		)
	}
}
