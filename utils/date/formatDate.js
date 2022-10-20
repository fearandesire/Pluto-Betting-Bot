import { format } from 'date-fns'

/**
 * @module formatDate
 * Surround the given date with the current month and year | E.g 1/10/2022
 */

export async function formatDate(date) {
    date = parseInt(date)
    //# if the first character is a zero, remove it
    if (date.toString().charAt(0) === '0') {
        date = date.toString().slice(1)
    }
    var todaysDate = new Date()
    var month = format(todaysDate, 'M')
    var year = format(todaysDate, 'yyyy')
    var formattedDate = `${month}/${date}/${year}`
    return formattedDate
}
