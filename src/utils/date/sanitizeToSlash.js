import { format } from 'date-fns'

/**
 * @module sanitzeToSlash
 * Convert the input into a date object with the format: mm/dd/yyyy and return it.
 * Strip any non-number characters from the input. We are expecting an input of the days, so it should only be 2 numbers max with no need for a 0.
 */
export function sanitizeToSlash(input) {
    input = input.toString()
    if (
        (input.length > 4 && !input.match(/[[th]/gi)) ||
        input <= 0 ||
        input.match(/\//g)
    ) {
        return false
    } else {
        if (input.charAt(0) === '0') {
            input = input.slice(1)
        }
        var inputSanitized = parseInt(input)
        //# Get the month and year to format the string via date-fns
        var month = format(new Date(), `MM`)
        var year = format(new Date(), `yyyy`)
        var date = `${month}/${inputSanitized}/${year}`
        return date
    }
}
