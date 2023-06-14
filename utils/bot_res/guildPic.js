export const guildImgURL = (client) => {
	const guild = client.guilds.cache.first() // get the first guild in the cache
	if (!guild) {
		return null // no guild found
	}
	const iconURL = guild.iconURL({ dynamic: true }) // get the guild's icon URL
	return iconURL
}
