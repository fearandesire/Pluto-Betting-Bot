import { db } from '#db'

/**
 * Validate the data in the database provided. This function is used to find if X data currently exists in Y table.
 * Featuring several different methods, this constructor function will have several different parameter options for each.
 */

export default function QueryHandler(queryData) {
	this.tables = queryData?.tables || null
	this.values = queryData?.values || null
	this.columns = queryData?.columns || null
	this.where = queryData?.where || null

	/**
	 * @method uniqueRow
	 * Search for a unique (one) row in the database.
	 * @returns {obj} - The row found in the database
	 */
	this.uniqueRow = async () => {
		const queryStr = `SELECT * FROM "${this.tables}" WHERE ${this.columns} = $1`
		const query = await db.oneOrNone(queryStr, [
			this.values,
		])
		return query
	}
	/**
	 * @method uniqueRowOr
	 * Search for a unique (one) row in the database between two different columns, same value.
	 * @returns {obj} - The row found in the database
	 */
	this.uniqueRowOr = async () => {
		const queryStr = `SELECT * FROM "${this.tables}" WHERE ${this.columns[0]} = $1 OR ${this.columns[1]} = $1`
		const query = await db.oneOrNone(
			queryStr,
			this.values,
		)
		return query
	}
	this.count = async () => {
		const queryStr = `SELECT COUNT(*) FROM "${this.tables}" WHERE ${this.where} = $1`
		const query = await db.oneOrNone(queryStr, [
			this.values,
		])
		return query
	}
	this.countAll = async () => {
		const queryStr = `SELECT COUNT(*) FROM "${this.tables}"`
		const query = await db.oneOrNone(queryStr)
		return query
	}
	/**
	 * @function sumAll
	 * Query a table and sum all values from specified column with a WHERE clause
	 *
	 */
	this.sumAll = async () => {
		const queryStr = `SELECT SUM (DISTINCT ${this.columns}) FROM "${this.tables}" WHERE ${this.where} = $1`
		const query = await db.oneOrNone(queryStr, [
			this.values,
		])
		return query
	}
	/**
	 * @function topWager
	 * Query a table and return the highest value from specified column with a WHERE clause
	 */
	this.topWager = async () => {
		const queryStr = `SELECT MAX (DISTINCT ${this.columns}) FROM "${this.tables}" WHERE ${this.where} = $1`
		const query = await db.oneOrNone(queryStr, [
			this.values,
		])
		return query
	}
}
