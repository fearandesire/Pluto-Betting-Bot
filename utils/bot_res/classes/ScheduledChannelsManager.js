import Cache from '@pluto-redis'

export default class ScheduledChannelsManager {
	constructor() {
		this.scheduledCache = `scheduled_games`
	}

	async getAll() {
		return Cache().get(`${this.scheduledCache}`)
	}
}
