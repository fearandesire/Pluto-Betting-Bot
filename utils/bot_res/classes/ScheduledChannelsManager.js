import Cache from '#rCache'


export default class ScheduledChannelsManager {
	constructor() {
		this.scheduledCache = `scheduled_games`
	}
	
	async getAll() {
		return Cache().get(`${this.scheduledCache}`)
	}
}