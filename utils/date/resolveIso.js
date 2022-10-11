import currentWeekNumber from 'current-week-number'

/**
 * @module resolveIso
 * Resolve the date from the provided ISO String
 * @return {integer | string | obj} Return date information based on the format requested
 */

export function resolveIso(isoDate) {
    this.isoDate = isoDate
    this.apiDate = new Date(isoDate)
    var localDate = this.apiDate.toLocaleString()
    var localDateSplit = localDate?.split(`,`)
    var localDateSplit2 = localDateSplit[1]?.split(`:`)
    var dayNum = this.apiDate.getDate()
    var region = `en-US`
    var options = { timeStyle: `short`, hourCycle: `h23` }
    var timeFormatted = this.apiDate.toLocaleString(region, options)
    this.timeRaw = timeFormatted.toString().replace(`:`, ``)
    this.dayNum = this.apiDate.getDate()
    this.month = this.apiDate.getMonth() + 1
    this.year = this.apiDate.getFullYear()
    this.hour = parseInt(timeFormatted.split(`:`)[0])
    this.minute = parseInt(timeFormatted.split(`:`)[1])
    this.apiDateFull = `${this.month} ${this.dayNum}, ${this.year}`
    this.weekNum = currentWeekNumber(this.apiDateFull)
    this.dayOfWeek = this.apiDate.toLocaleString(`en-US`, { weekday: `short` })
    this.rawDate = parseInt(`${this.dayNum}${this.hour}${this.minute}`)
    this.startTime = {
        hour: this.hour,
        minute: this.minute,
        dayNum: this.dayNum,
        dayOfWeek: this.dayOfWeek,
        monthNum: this.month,
        yearNum: this.year,
        weekNum: this.apiWeekNum,
    }
}
