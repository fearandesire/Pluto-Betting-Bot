/**
 * @module cronMath
 * Add or subtract from a Cron Job time string
 */
export function cronMath(cronTime) {
    this.cronTime = cronTime
    this.splitCron = this.cronTime.split(' ')
    this.minutes = Number(this.splitCron[0])
    this.hours = Number(this.splitCron[1])
    this.dayOfMonth = Number(this.splitCron[2])
    this.month = Number(this.splitCron[3])
    this.dayOfWeek = Number(this.splitCron[4])
    this.subtract = async function (amount, timeUnit) {
        amount = Number(amount)
        switch (timeUnit) {
            case 'minutes':
                this.minutes = this.minutes - amount
                break
            case 'hours':
                this.hours = this.hours - amount
                break
            case 'dayOfMonth':
                this.dayOfMonth = this.dayOfMonth - amount
                break
            case 'month':
                this.month = this.month - amount
                break
            case 'dayOfWeek':
                this.dayOfWeek = this.dayOfWeek - amount
                break
        }
        return `${this.minutes} ${this.hours} ${this.dayOfMonth} ${this.month} ${this.dayOfWeek}`
    }
    this.add = async function (amount, timeUnit) {
        amount = Number(amount)
        switch (timeUnit) {
            case 'minutes':
                this.minutes = this.minutes + amount
                break
            case 'hours':
                this.hours = this.hours + amount
                break
            case 'dayOfMonth':
                this.dayOfMonth = this.dayOfMonth + amount
                break
            case 'month':
                this.month = this.month + amount
                break
            case 'dayOfWeek':
                this.dayOfWeek = this.dayOfWeek + amount
                break
        }
        return `${this.minutes} ${this.hours} ${this.dayOfMonth} ${this.month} ${this.dayOfWeek}`
    }
}
