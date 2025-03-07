import _ from 'lodash';
import { fromZodError } from 'zod-validation-error';
import { ValidationError } from '../../../utils/errors/ValidationError.js';
import { WinstonLogger } from '../../logging/WinstonLogger.js';
import {
	PropArraySchema,
	type PropEmbedsIncoming,
	PropEmbedsIncomingSchema,
	PropOptionsSchema,
} from '../common/interfaces/index.js';
import {
	GuildChannelArraySchema,
	type ReqBodyPropsEmbedsData,
} from '../routes/props/props-route.interface.js';
import { PropsPresentation } from '../services/props-presentation.service.js';
/**
 * Handling processing data for incoming requests for props
 */

export class PropsController {
	private propsService: PropsPresentation;

	constructor() {
		this.propsService = new PropsPresentation();
	}

	validateReqPropEmbedBody(body: ReqBodyPropsEmbedsData) {
		try {
			const propsResult = PropArraySchema.safeParse(body.props);
			const guildChannelsResult = GuildChannelArraySchema.safeParse(
				body.guilds,
			);
			const optionsDefault = { daysAhead: 7 };
			const optionsResult = PropOptionsSchema.safeParse(optionsDefault);

			// Collect all validation errors
			const errors: string[] = [];

			if (!propsResult.success) {
				errors.push(
					`Props validation: ${fromZodError(propsResult.error).message}`,
				);
			}
			if (!guildChannelsResult.success) {
				errors.push(
					`Guild channels validation: ${fromZodError(guildChannelsResult.error).message}`,
				);
			}
			if (!optionsResult.success) {
				errors.push(
					`Options validation: ${fromZodError(optionsResult.error).message}`,
				);
			}

			if (errors.length > 0) {
				throw new ValidationError(
					'Request body validation failed',
					errors,
					this.validateReqPropEmbedBody.name,
				);
			}

			return {
				props: propsResult.data,
				guildChannels: guildChannelsResult.data,
				options: optionsResult.data,
			};
		} catch (error) {
			if (error instanceof ValidationError) {
				throw error;
			}

			throw new ValidationError(
				'Unexpected validation error',
				error,
				this.validateReqPropEmbedBody.name,
			);
		}
	}

	async processPropsForPredictionEmbeds(
		body: ReqBodyPropsEmbedsData,
	): Promise<{ success: boolean; message: string; details?: unknown }> {
		try {
			WinstonLogger.info({
				message: 'Processing props embeds generation request',
				metadata: {
					source: this.processPropsForPredictionEmbeds.name,
					bodyLength: body.props?.length || 0,
					guildsLength: body.guilds?.length || 0,
				},
			});

			const validatedData = this.validateReqPropEmbedBody(body);
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
		} catch (error) {
			const errorMessage =
				_.isError(error) || error instanceof ValidationError
					? error.message
					: 'Validation failed due to an unknown error';

			WinstonLogger.error({
				message: errorMessage,
				metadata: {
					source: this.processPropsForPredictionEmbeds.name,
					details: error instanceof ValidationError ? error.details : undefined,
					stack: _.isError(error) ? error.stack : undefined,
				},
			});

			return {
				success: false,
				message: errorMessage,
				details: error instanceof ValidationError ? error.details : undefined,
			};
		}
	}

	validatePredictionStatsBody(body: ReqBodyPropsEmbedsData) {
		const result = PropEmbedsIncomingSchema.safeParse(body);
		return result;
	}

	/**
	 * @summary Iterate through receiving data - create an embed for each record and display the stats of each prop.
	 * @description This method is used to post stats of the props that have just recently started. It will go through the incoming data which will have the stats already aggregated.
	 * Each object in the array will be the data included to make the embed.
	 */
	async processPostStart(
		body: ReqBodyPropsEmbedsData,
	): Promise<PropEmbedsIncoming> {
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
