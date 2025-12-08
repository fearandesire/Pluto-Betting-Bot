import type { CommandInteraction } from 'discord.js'
import { ApiModules } from '../../../../lib/interfaces/api/api.interface.js'
import { ApiErrorHandler } from '../error-handling/ApiErrorHandler.js'
import PropsApiWrapper from './props-api-wrapper.js'

/**
 * App / Business specific logic
 */
export default class PropsRepoService {
	private propsApi: PropsApiWrapper

	constructor() {
		this.propsApi = new PropsApiWrapper()
	}

	async getById(args: { interaction: CommandInteraction; id: string }) {
		try {
			return await this.propsApi.getPropByUuid(args.id)
		} catch (error) {
			console.error(error)
			return await new ApiErrorHandler().handle(
				args.interaction,
				error,
				ApiModules.props,
			)
		}
	}
}
