/* eslint-disable default-case */
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
	this.subtract30Mins = async function () {
		if (this.minutes === 0) {
			this.hours -= 1
			this.minutes = 30
		} else if (this.minutes === 30) {
			this.minutes = 0
		}
		return `${this.minutes} ${this.hours} ${this.dayOfMonth} ${this.month} ${this.dayOfWeek}`
	}
	this.subtract = async function (amount, timeUnit) {
		switch (timeUnit) {
			case 'minutes':
				this.minutes -= amount
				break
			case 'hours':
				this.hours -= amount
				break
			case 'dayOfMonth':
				this.dayOfMonth -= amount
				break
			case 'month':
				this.month -= amount
				break
			case 'dayOfWeek':
				this.dayOfWeek -= amount
				break
		}
		return `${this.minutes} ${this.hours} ${this.dayOfMonth} ${this.month} ${this.dayOfWeek}`
	}
	this.add = async function (amount, timeUnit) {
		amount = Number(amount)
		switch (timeUnit) {
			case 'minutes':
				this.minutes += amount
				break
			case 'hours':
				this.hours += amount
				break
			case 'dayOfMonth':
				this.dayOfMonth += amount
				break
			case 'month':
				this.month += amount
				break
			case 'dayOfWeek':
				this.dayOfWeek += amount
				break
		}
		return `${this.minutes} ${this.hours} ${this.dayOfMonth} ${this.month} ${this.dayOfWeek}`
	}
}
