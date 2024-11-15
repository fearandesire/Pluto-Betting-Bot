import { LogType } from '../../utils/logging/AppLog.interface.js';
import { Subcommand } from '@sapphire/plugin-subcommands';
import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import PropsApiWrapper from '../../utils/api/Khronos/props/propsApiWrapper.js';
import type { Prop } from '../../openapi/khronos/models/Prop.js';
import type { UpdatePropResultDto } from '../../openapi/khronos/models/UpdatePropResultDto.js';
import type { UpdatePropResultResponseDto } from '../../openapi/khronos/models/index.js';
import PropEmbedManager from '../../utils/guilds/prop-embeds/PropEmbedManager.js';
import { MarketKeyTranslations, type PropZod } from '@pluto-api-interfaces';
import { DateManager } from '../../utils/common/DateManager.js';
import TeamInfo from '../../utils/common/TeamInfo.js';
import AppLog from '../../utils/logging/AppLog.js';
import StringUtils from '../../utils/common/string-utils.js';
import { ApiErrorHandler } from '../../utils/api/Khronos/error-handling/ApiErrorHandler.js';
import { ApiModules } from '../../lib/interfaces/api/api.interface.js';

export class UserCommand extends Subcommand {
	public constructor(
		context: Subcommand.LoaderContext,
		options: Subcommand.Options,
	) {
		super(context, {
			...options,
			name: 'props',
			description: 'Manage props',
			subcommands: [
				{
					name: 'view',
					type: 'group',
					entries: [
						{ name: 'recent', chatInputRun: 'viewRecent' },
						{ name: 'active', chatInputRun: 'viewActive' },
						{ name: 'for_event', chatInputRun: 'viewForEvent' },
						{ name: 'upcoming', chatInputRun: 'viewUpcoming' },
						{ name: 'player', chatInputRun: 'viewForPlayer' },
					],
				},
				{
					name: 'generate',
					type: 'group',
					entries: [
						{ name: 'all', chatInputRun: 'generateAll' },
						{ name: 'prop_embed', chatInputRun: 'generatePropEmbed' },
					],
				},
				{
					name: 'manage',
					type: 'group',
					entries: [{ name: 'setresult', chatInputRun: 'manageSetresult' }],
				},
			],
		});
	}

	public override registerApplicationCommands(registry: Subcommand.Registry) {
		registry.registerChatInputCommand(
			(builder) =>
				builder
					.setName(this.name)
					.setDescription(this.description)
					.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
					.addSubcommandGroup((group) =>
						group
							.setName('view')
							.setDescription('View props')
							.addSubcommand((subcommand) =>
								subcommand
									.setName('recent')
									.setDescription('View props up to one week ago from today'),
							)
							.addSubcommand((subcommand) =>
								subcommand
									.setName('active')
									.setDescription('View props with active predictions'),
							)
							.addSubcommand((subcommand) =>
								subcommand
									.setName('player')
									.setDescription('View props for a specific player')
									.addStringOption((option) =>
										option
											.setName('player')
											.setDescription('The name of the player')
											.setRequired(true),
									),
							)
							.addSubcommand((subcommand) =>
								subcommand
									.setName('for_event')
									.setDescription('View all props for a specific event')
									.addStringOption((option) =>
										option
											.setName('event_id')
											.setDescription('The ID of the event')
											.setRequired(true),
									),
							)
							.addSubcommand((subcommand) =>
								subcommand
									.setName('upcoming')
									.setDescription('View upcoming props'),
							),
					)
					.addSubcommandGroup((group) =>
						group
							.setName('generate')
							.setDescription('Generate prop embeds')
							.addSubcommand((subcommand) =>
								subcommand
									.setName('all')
									.setDescription('Generate all prop embeds'),
							)
							.addSubcommand((subcommand) =>
								subcommand
									.setName('prop_embed')
									.setDescription('Create a prop embed for a specific event')
									.addStringOption((option) =>
										option
											.setName('prop_id')
											.setDescription('The ID of the prop')
											.setRequired(true),
									)
									.addStringOption((option) =>
										option
											.setName('market_key')
											.setDescription('The market key for the prop')
											.setRequired(true),
									)
									.addStringOption((option) =>
										option
											.setName('player')
											.setDescription('The player name for the prop')
											.setRequired(true),
									),
							),
					)
					.addSubcommandGroup((group) =>
						group
							.setName('manage')
							.setDescription('Manage props')
							.addSubcommand((subcommand) =>
								subcommand
									.setName('setresult')
									.setDescription('Set the result of a prop')
									.addStringOption((option) =>
										option
											.setName('prop_id')
											.setDescription('The ID of the prop')
											.setRequired(true),
									)
									.addStringOption((option) =>
										option
											.setName('result')
											.setDescription('The result of the prop')
											.setRequired(true),
									),
							),
					),
			{
				idHints: ['1289689518940622919', '1290465537859784745'],
			},
		);
	}

	public async viewForPlayer(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		return this.viewPropsByPlayer(interaction);
	}

	// View group methods
	public async viewRecent(interaction: Subcommand.ChatInputCommandInteraction) {
		return this.viewRecentProps(interaction);
	}

	public async viewActive(interaction: Subcommand.ChatInputCommandInteraction) {
		await interaction.deferReply();
		return this.viewActiveProps(interaction);
	}

	public async viewForEvent(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		return this.viewPropsForEvent(interaction);
	}

	// NOTE: Needs further filtering to be implemented, since there's a high number of props
	public async viewUpcoming(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		await interaction.deferReply();
		return this.viewUpcomingProps(interaction);
	}

	// Generate group methods
	public async generateAll(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		return this.generateProps(interaction);
	}

	public async generatePropEmbed(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		return this.createPropEmbed(interaction);
	}

	// Manage group methods
	public async manageSetresult(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		return this.setResult(interaction);
	}

	private async viewPropsByPlayer(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		try {
			const player = interaction.options.getString('player', true);
			const propsApi = new PropsApiWrapper();

			const props = await propsApi.getPropsByPlayer({ description: player });

			return this.sendPropsEmbed(
				interaction,
				props as Prop[],
				`Props for ${props[0].description}`,
				`${props.length} total props`,
			);
		} catch (error) {
			this.container.logger.error(error);
			return interaction.editReply({
				content: 'An error occured while retrieving the requested data.',
			});
		}
	}

	private async viewPropsForEvent(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		const eventId = interaction.options.getString('event_id', true);

		const propsApi = new PropsApiWrapper();

		try {
			const props: Prop[] = await propsApi.getPropsByEventId(eventId);

			return this.sendPropsEmbed(
				interaction,
				props,
				'Props for Event',
				`Displaying all props for event: ${eventId}`,
			);
		} catch (error) {
			this.container.logger.error(error);
			return interaction.reply({
				content:
					'An error occurred while fetching props. Please try again later.',
				ephemeral: true,
			});
		}
	}

	private async generateProps(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		await interaction.deferReply();
		await interaction.editReply({
			content: 'Generating prop embeds, please wait...',
		});
		await new PropsApiWrapper().generateAllPropEmbeds({
			guildId: interaction.guildId,
		});

		await interaction.editReply({
			content: 'Prop Embeds populated successfully',
		});

		await AppLog.log({
			guildId: interaction.guildId,
			description: `${interaction.user.username} generated all prop embeds`,
			type: LogType.Info,
		});
	}

	private async setResult(interaction: Subcommand.ChatInputCommandInteraction) {
		const propId = interaction.options.getString('prop_id', true);
		const result = interaction.options.getString('result', true);

		const propsApi = new PropsApiWrapper();

		try {
			await interaction.deferReply();

			const response = await propsApi.setResult({
				updatePropResultDto: {
					propId,
					winner: result,
					status: 'completed' as UpdatePropResultDto['status'],
					user_id: interaction.user.id,
				},
				override: false,
			});

			const embed = this.createResultEmbed(response);

			await AppLog.log({
				guildId: interaction.guildId,
				description: `Prop result updated for ${propId}`,
				type: LogType.Info,
			});

			return interaction.editReply({ embeds: [embed] });
		} catch (error) {
			this.container.logger.error(error);
			return new ApiErrorHandler().handle(interaction, error, ApiModules.props);
		}
	}

	private createResultEmbed(
		response: UpdatePropResultResponseDto,
	): EmbedBuilder {
		const embed = new EmbedBuilder()
			.setTitle('Prop Result Updated')
			.setColor('#00FF00')
			.addFields(
				{
					name: 'Correct Predictions',
					value: response.correct_predictions_count.toString(),
					inline: true,
				},
				{
					name: 'Incorrect Predictions',
					value: response.incorrect_predictions_count.toString(),
					inline: true,
				},
				{
					name: 'Total Predictions',
					value: response.total_predictions_count.toString(),
					inline: true,
				},
			);

		return embed;
	}

	private async viewActiveProps(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		const propsApi = new PropsApiWrapper();

		try {
			const props: Prop[] = await propsApi.getAll({
				withActivePredictions: true,
			});

			return this.sendPropsEmbed(
				interaction,
				props,
				'Active Props',
				'Displaying props with active predictions',
				{ isViewingActiveProps: true },
			);
		} catch (error) {
			this.container.logger.error(error);
			return new ApiErrorHandler().handle(interaction, error, ApiModules.props);
		}
	}

	private async viewUpcomingProps(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		const propsApi = new PropsApiWrapper();

		try {
			const props: Prop[] = await propsApi.getAll({ upcoming: true });

			return this.sendPropsEmbed(
				interaction,
				props,
				'Upcoming Props',
				'Displaying upcoming props.',
			);
		} catch (error) {
			this.container.logger.error(error);
			return new ApiErrorHandler().handle(interaction, error, ApiModules.props);
		}
	}

	private async viewRecentProps(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		const propsApi = new PropsApiWrapper();

		try {
			const props: Prop[] = await propsApi.getAll({ withinOneWeek: true });

			// Group props by event ID
			const eventMap = new Map<string, Prop>();
			for (const prop of props) {
				if (!eventMap.has(prop.event_id)) {
					eventMap.set(prop.event_id, prop);
				}
			}

			const uniqueEvents = Array.from(eventMap.values());

			return this.sendRecentEventsEmbed(
				interaction,
				uniqueEvents,
				'Recent Props',
				'Displaying recent props.',
			);
		} catch (error) {
			this.container.logger.error(error);
			return new ApiErrorHandler().handle(interaction, error, ApiModules.props);
		}
	}

	private async sendRecentEventsEmbed(
		interaction: Subcommand.ChatInputCommandInteraction,
		events: Prop[],
		title: string,
		description: string,
	) {
		if (events.length === 0) {
			return interaction.reply({
				content: 'No recent props found.',
				ephemeral: true,
			});
		}

		const embed = new EmbedBuilder()
			.setTitle(`🗓️ ${title}`)
			.setDescription(
				`${description}\nUse \`/props view_for_event <event_id>\` to see props for a specific event.`,
			)
			.setColor('#0099ff')
			.setTimestamp();

		events.slice(0, 25).forEach((event, index) => {
			embed.addFields({
				name: `${index + 1}. ${event.home_team} vs ${event.away_team}`,
				value: this.formatEventField(event),
			});
		});

		if (events.length > 25) {
			embed.setFooter({
				text: `Showing 25 out of ${events.length} events. Use the 'view_for_event' command to see props for a specific event.`,
			});
		}

		return interaction.reply({ embeds: [embed] });
	}

	private formatEventField(event: Prop): string {
		const date = new DateManager().toDiscordUnix(event.commence_time);
		const shortenTeamName = (teamName: string) => {
			return TeamInfo.getTeamShortName(teamName);
		};
		const hTeamShort = shortenTeamName(event.home_team);
		const aTeamShort = shortenTeamName(event.away_team);

		return `🆔 **Event ID:** \`${event.event_id}\`
				⚔️ **Match:** ${hTeamShort} vs ${aTeamShort}
				🗓️ **Date:** ${date}`;
	}

	private async sendPropsEmbed(
		interaction: Subcommand.ChatInputCommandInteraction,
		props: Prop[],
		title: string,
		description: string,
		options?: PropEmbedOptions,
	) {
		try {
			if (props.length === 0) {
				return interaction.editReply({
					content: 'No props were found matching the search criteria.',
				});
			}
			let embed: EmbedBuilder;
			if (!options?.isViewingActiveProps) {
				const firstProp = props[0];
				const date = new DateManager().toDiscordUnix(firstProp.commence_time);
				const eventId = firstProp.event_id;
				embed = new EmbedBuilder()
					.setTitle(`${title}`)
					.setDescription(
						`${description}\n\n**Event Information**\n🆔 **Event ID:** \`${eventId}\`\n🗓️ **Date:** ${date}\n${firstProp.home_team} vs ${firstProp.away_team}`,
					)
					.setColor('#0099ff')
					.setTimestamp();

				const formattedProps = this.formatPropsForEmbed(props);
				for (const field of formattedProps) {
					embed.addFields(field);
				}
			}
			if (options?.isViewingActiveProps) {
				embed = new EmbedBuilder()
					.setTitle(title)
					.setDescription(description)
					.setColor('#0099ff')
					.setTimestamp();

				const formattedProps = this.formatPropsForEmbed(props);
				for (const field of formattedProps) {
					embed.addFields(field);
				}
			}
			if (props.length > 25) {
				embed.setFooter({
					text: `Showing 25 out of ${props.length} props. More props are available, but cannot be displayed in this embed.`,
				});
			}
			return interaction.editReply({ embeds: [embed] });
		} catch (error) {
			this.container.logger.error(error);
			return new ApiErrorHandler().handle(interaction, error, ApiModules.props);
		}
	}

	private formatPropsForEmbed(
		props: Prop[],
	): { name: string; value: string }[] {
		return props.slice(0, 25).map((prop) => {
			let pointDisplay = '';
			if (
				prop.market_key.toLowerCase() !== 'h2h' &&
				!prop.market_key.toLowerCase().includes('total')
			) {
				pointDisplay = prop.point ? `\n**Over/Under:** ${prop.point}` : '';
			}
			const translatedKey = StringUtils.toTitleCase(
				MarketKeyTranslations[prop.market_key],
			);
			const hasPlayer = prop?.description;
			let title = translatedKey;
			if (hasPlayer) {
				title = `${prop.description} - ${translatedKey}`;
			}
			return {
				name: title,
				value: `**Prop ID:** ${prop.id}${pointDisplay}`,
				inline: false,
			};
		});
	}

	private async createPropEmbed(
		interaction: Subcommand.ChatInputCommandInteraction,
	) {
		const propId = interaction.options.getString('prop_id', true);
		const marketKey = interaction.options
			.getString('market_key', true)
			.toLowerCase();
		const player = interaction.options.getString('player', true).toLowerCase();

		const propsApi = new PropsApiWrapper();

		try {
			await interaction.deferReply();

			const prop = (await propsApi.getPropById(propId)) as unknown as PropZod;

			if (!prop) {
				return interaction.editReply({
					content: `No prop found with ID: ${propId}`,
				});
			}

			if (
				prop.market_key.toLowerCase() !== marketKey.toLowerCase() ||
				prop.description?.toLowerCase() !== player.toLowerCase()
			) {
				return interaction.editReply({
					content:
						'The provided market key or player does not match the prop details.',
				});
			}

			const propEmbedManager = new PropEmbedManager(this.container.client);
			const HTEAM_TRANSFORMED = await propEmbedManager.transformTeamName(
				prop.home_team,
			);
			const AWTEAM_TRANSFORMED = await propEmbedManager.transformTeamName(
				prop.away_team,
			);
			const HTEAM_SHORT_NAME = new StringUtils().getShortName(prop.home_team);
			const AWTEAM_SHORT_NAME = new StringUtils().getShortName(prop.away_team);

			const { embed, row } = await propEmbedManager.createSingleEmbed(prop, {
				home: {
					fullName: prop.home_team,
					transformed: HTEAM_TRANSFORMED,
					shortName: HTEAM_SHORT_NAME,
				},
				away: {
					fullName: prop.away_team,
					transformed: AWTEAM_TRANSFORMED,
					shortName: AWTEAM_SHORT_NAME,
				},
			});

			await interaction.editReply({ embeds: [embed], components: [row] });

			await AppLog.log({
				guildId: interaction.guildId,
				description: `Prop embed created for ${propId}`,
				type: LogType.Info,
			});
		} catch (error) {
			this.container.logger.error(error);
			return interaction.editReply({
				content:
					'An error occurred while creating the prop embed. Please try again later.',
			});
		}
	}
}

interface PropEmbedOptions {
	isViewingActiveProps?: boolean;
}
