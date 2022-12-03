import { db } from '#db'

/**
 * @module validateData
 * Validate the data in the database provided. This function is used to find if X data currently exists in Y table.
 * Featuring several different methods, this constructor function will have several different parameter options for each.
 */

export function validateData(queryData) {
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
        let query = `SELECT * FROM "${this.tables}" WHERE ${this.columns} = $1`
        return await db.oneOrNone(query, [this.values])
    }
    /**
     * @method uniqueRowOr
     * Search for a unique (one) row in the database between two different columns, same value.
     * @returns {obj} - The row found in the database
     */
    this.uniqueRowOr = async () => {
        let query = `SELECT * FROM "${this.tables}" WHERE ${this.columns[0]} = $1 OR ${this.columns[1]} = $1`
        return await db.oneOrNone(query, this.values)
    }
    this.count = async () => {
        let query = `SELECT COUNT(*) FROM "${this.tables}" WHERE ${this.where} = $1`
        return await db.oneOrNone(query, [this.values])
    }
    this.countAll = async () => {
        let query = `SELECT COUNT(*) FROM "${this.tables}"`
        return await db.oneOrNone(query)
    }
    /**
     * @function sumAll
     * Query a table and sum all values from specified column with a WHERE clause
     *
     */
    this.sumAll = async () => {
        let query = `SELECT SUM (DISTINCT ${this.columns}) FROM "${this.tables}" WHERE ${this.where} = $1`
        return await db.oneOrNone(query, [this.values])
    }
    /**
     * @function topWager
     * Query a table and return the highest value from specified column with a WHERE clause
     */
    this.topWager = async () => {
        let query = `SELECT MAX (DISTINCT ${this.columns}) FROM "${this.tables}" WHERE ${this.where} = $1`
        return await db.oneOrNone(query, [this.values])
    }
}
