import {
	PropArraySchema,
	PropEmbedsIncomingSchema,
	PropOptionsSchema,
	type PropEmbedsIncoming,
} from '../common/interfaces/index.js';
import {
	GuildChannelArraySchema,
	type RequestBody,
	type ValidatedData,
} from '../routes/props/props-route.interface.js';
import { PropsPresentation } from '../services/props-presentation.service.js';
import { z } from 'zod';

export class PropsController {
	private propsService: PropsPresentation;

	constructor() {
		this.propsService = new PropsPresentation();
	}

	validateReqPropEmbedBody(body: RequestBody): ValidatedData | null {
		const propsResult = PropArraySchema.safeParse(body.props);
		const guildChannelsResult = GuildChannelArraySchema.safeParse(
			body.guildChannels,
		);
		const optionsDefault = { daysAhead: 7 };
		const optionsResult = PropOptionsSchema.safeParse(optionsDefault);

		if (
			!propsResult.success ||
			!guildChannelsResult.success ||
			!optionsResult.success
		) {
			return null;
		}

		return {
			props: propsResult.data,
			// @ts-expect-error - zod issue
			guildChannels: guildChannelsResult.data,
			options: optionsResult.data,
		};
	}

	async processDaily(
		body: RequestBody,
	): Promise<{ success: boolean; message: string }> {
		const validatedData = this.validateReqPropEmbedBody(body);

		if (!validatedData) {
			return { success: false, message: 'Invalid request body' };
		}

		// Filter out 'h2h' and 'totals' props
		const filteredProps = await this.propsService.filterPropsByMarketKeys(
			validatedData.props,
		);
		await this.propsService.processAndCreateEmbeds(
			filteredProps,
			validatedData.guildChannels,
			validatedData.options,
		);

		return {
			success: true,
			message: 'Props processed and embeds created successfully',
		};
	}

	validatePredictionStatsBody(body: RequestBody) {
		const result = PropEmbedsIncomingSchema.safeParse(body);
		return result;
	}

	/**
	 * @summary Iterate through receiving data - create an embed for each record and display the stats of each prop.
	 * @description This method is used to post stats of the props that have just recently started. It will go through the incoming data which will have the stats already aggregated.
	 * Each object in the array will be the data included to make the embed.
	 */
	async processPostStart(body: RequestBody): Promise<PropEmbedsIncoming> {
		const validatedData = this.validatePredictionStatsBody(body);

		if (!validatedData.success) {
			const errData = {
				source: this.validatePredictionStatsBody.name,
				message: 'Failed to validate prediction stats array',
				error: validatedData.error,
			};
			console.error(errData);
			throw Error(`${errData.message}: ${errData.error.message}`);
		}

		return validatedData.data;
	}
}
