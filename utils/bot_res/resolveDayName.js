/**
 * Takes a number and returns the name of the day of the week.
 * @param dayNum - The day of the week, as a number (0-6)
 * @returns {string} - The name of the day
 */
export async function resolveDayName(dayNum) {
    var weekDays = ['Sun', 'Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat']
    var dayOfWeek = weekDays[dayNum]
    return dayOfWeek
}
