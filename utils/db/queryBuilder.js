/**
 * @module queryBuilder.js
 * Build a query object for the database
    * @param {string} table - The table to query
    * @param {string} columns - The columns to query
    * @param {string} values - The values to query
    @returns {obj} - The query object
*/
export function queryBuilder(table, columns, values) {
    return {
        tables: table,
        columns: columns,
        values: values,
    }
}
