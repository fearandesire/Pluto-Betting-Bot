export class GuildManager {
	constructor(guild) {
		this.guild = guild
	}

	async fetchChannelViaId(chanId) {
		return this.guild.channels.fetch(chanId)
	}
}
