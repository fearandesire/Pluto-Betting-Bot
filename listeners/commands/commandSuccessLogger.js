import {
	Events,
	Listener,
	LogLevel,
} from '@sapphire/framework'

export class UserEvent extends Listener {
	constructor(context, options = {}) {
		super(context, {
			...options,
			event: Events.CommandSuccess,
		})
	}

	run({ message, command }) {
		const shard = this.shard(
			message.guild?.shardId ?? 0,
		)
		const commandName = this.command(command)
		const author = this.author(message.author)
		const sentAt = message.guild
			? this.guild(message.guild)
			: this.direct()
		this.container.logger.debug(
			`${shard} - ${commandName} ${author} ${sentAt}`,
		)
	}

	onLoad() {
		this.enabled =
			this.container.logger.level <= LogLevel.Debug
		return super.onLoad()
	}

	shard(id) {
		return `[${console.log(id.toString())}]`
	}

	command(command) {
		return console.log(command.name)
	}

	author(author) {
		return `${author.username}[${console.log(
			author.id,
		)}]`
	}

	direct() {
		return console.log('Direct Messages')
	}

	guild(guild) {
		return `${guild.name}[${console.log(guild.id)}]`
	}
}
