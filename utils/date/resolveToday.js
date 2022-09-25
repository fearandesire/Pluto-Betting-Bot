import currentWeekNumber from 'current-week-number'

/**
 * Resolves this.today's date
 * @return {object} Returns this.today's date information
 */
export function resolveToday() {
    this.today = new Date()
    this.dayNum = this.today.getDate()
    this.todaysMonth = this.today.getMonth() + 1
    this.todaysYear = this.today.getFullYear()
    this.todayFull = `${this.todaysMonth} ${this.dayNum}, ${this.todaysYear}`
    this.currWeekNum = currentWeekNumber(this.todayFull)
    this.weekNum = parseInt(this.currWeekNum)
    this.weekDay = ['Sun', 'Mon', 'Tues', 'Wed', 'Thur', 'Fri', 'Sat']
    this.dayOfWeek = this.weekDay[this.today.getDay()]
    this.hour = this.today.getHours()
    this.minute = this.today.getMinutes()
    this.rawDate = parseInt(`${this.dayNum}${this.hour}${this.minute}`)
    this.todaysDate = {
        dayNum: this.dayNum,
        dayOfWeek: this.dayOfWeek,
        monthNum: this.todaysMonth,
        yearNum: this.todaysYear,
        hour: this.hour,
        minute: this.minute,
        weekNum: this.weekNum,
    }
}
