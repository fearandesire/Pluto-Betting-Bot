import {
	PropArraySchema,
	PropOptionsSchema,
} from '../common/interfaces/index.js';
import {
	GuildChannelArraySchema,
	type RequestBody,
	type ValidatedData,
} from '../routes/props/props-route.interface.js';
import { PropsService } from '../services/props.service.js';

export class PropsController {
	private propsService: PropsService;

	constructor() {
		this.propsService = new PropsService();
	}

	validateRequestBody(body: RequestBody): ValidatedData | null {
		const propsResult = PropArraySchema.safeParse(body.props);
		const guildChannelsResult = GuildChannelArraySchema.safeParse(
			body.guildChannels,
		);
		const optionsDefault = { daysAhead: 2 };
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
		const validatedData = this.validateRequestBody(body);

		if (!validatedData) {
			return { success: false, message: 'Invalid request body' };
		}

		await this.propsService.processAndCreateEmbeds(
			validatedData.props,
			validatedData.guildChannels,
			validatedData.options,
		);

		return {
			success: true,
			message: 'Props processed and embeds created successfully',
		};
	}
}
