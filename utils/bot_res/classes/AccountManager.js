import { db } from '#db';


export default class AccountManager {
	constructor(accountTable) {
		this.accountTable = accountTable
	}

	async getAll() {
		return db.manyOrNone(
			`SELECT * FROM "${this.accountTable}"`,
		)
	}
}
