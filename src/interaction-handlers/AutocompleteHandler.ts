import {
	InteractionHandler,
	InteractionHandlerTypes,
} from "@sapphire/framework";
import type { AutocompleteInteraction } from "discord.js";
import MatchCacheService from "../utils/api/routes/cache/MatchCacheService.js";
import { CacheManager } from "../utils/cache/RedisCacheManager.js";
import type { Match } from "@kh-openapi/index.js";
import StringUtils from "../utils/common/string-utils.js"; // Import StringUtils

export class AutocompleteHandler extends InteractionHandler {
	private matchCacheService: MatchCacheService; // Moved to class property
	private stringUtils: StringUtils; // Moved to class property

	public constructor(
		ctx: InteractionHandler.LoaderContext,
		options: InteractionHandler.Options,
	) {
		super(ctx, {
			...options,
			interactionHandlerType: InteractionHandlerTypes.Autocomplete,
		});
		this.matchCacheService = new MatchCacheService(new CacheManager()); // Instantiate once
		this.stringUtils = new StringUtils(); // Instantiate once
	}

	public override async run(
		interaction: AutocompleteInteraction,
		result: InteractionHandler.ParseResult<this>,
	) {
		return interaction.respond(result);
	}

	// @ts-ignore - Weird TS Error
	public override async parse(interaction: AutocompleteInteraction) {
		if (interaction?.commandName !== "bet") return this.none();
		const focusedOption = interaction.options.getFocused(true);
		const matches = await this.matchCacheService.getMatches();

		switch (focusedOption.name) {
			case "match": {
				const currentInput = focusedOption.value as string;
				const searchResult = matches.filter((match: Match) => {
					const homeTeam = match.home_team.toLowerCase();
					const awayTeam = match.away_team.toLowerCase();
					return (
						homeTeam.includes(currentInput.toLowerCase()) ||
						awayTeam.includes(currentInput.toLowerCase())
					);
				});
				return this.some(
					searchResult.map((match: Match) => ({
						name: `${this.stringUtils.getShortName(match.away_team)} @ ${this.stringUtils.getShortName(match.home_team)} | ${match.dateofmatchup}`,
						value: match.id,
					})),
				);
			}
			case "team": {
				const matchSelection = interaction.options.getString("match", true);
				const selectedMatch = matches.find(
					(match: Match) => match.id === matchSelection,
				);

				if (selectedMatch) {
					const teams = [selectedMatch.home_team, selectedMatch.away_team];
					return this.some(
						teams.map((team) => ({
							name: team,
							value: team,
						})),
					);
				}
				return this.none();
			}
			default:
				return this.none();
		}
	}
}
