import { format } from 'date-fns'

/**
 * @module formatDate
 * Surround the given date with the current month and year | E.g 1/10/2022
 */

export async function formatDate(date) {
    var todaysDate = new Date()
    var month = format(todaysDate, 'M')
    var year = format(todaysDate, 'yyyy')
    var formattedDate = `${month}/${date}/${year}`
    return formattedDate
}
