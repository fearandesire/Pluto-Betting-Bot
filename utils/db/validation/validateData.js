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

    /**
     * @method uniqueRow
     * Search for a unique (one) row in the database.
     * @returns {obj} - The row found in the database
     */
    this.uniqueRow = async () => {
        let query = `SELECT * FROM ${this.tables} WHERE ${this.columns} = $1`
        return await db.oneOrNone(query, [this.values])
    }
    /**
     * @method uniqueRowOr
     * Search for a unique (one) row in the database between two different columns, same value.
     * @returns {obj} - The row found in the database
     */
    this.uniqueRowOr = async () => {
        let query = `SELECT * FROM ${this.tables} WHERE ${this.columns[0]} = $1 OR ${this.columns[1]} = $1`
        return await db.oneOrNone(query, this.values)
    }
}
