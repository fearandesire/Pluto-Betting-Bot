import { Events, Listener } from '@sapphire/framework'

export class UserEvent extends Listener {
	constructor(context, options = {}) {
		super(context, {
			...options,
			event: Events.InteractionCreate,
		})
	}

	// eslint-disable-next-line no-unused-vars
	async run(interaction) {}
}
