import { findEmoji } from '@pluto-core-config';
import type { ColorResolvable, EmojiResolvable, GuildEmoji } from 'discord.js';
import { resolveTeam } from 'resolve-team';
import StringUtils from './string-utils.js';
import { container } from '@sapphire/framework';
import { slice } from 'lodash';

interface TeamShortNameOrEmojiOptions {
	nameWithEmoji?: boolean;
}

export interface GetTeamInfoResponse {
	emoji: string | GuildEmoji | EmojiResolvable;
	shortName: string;
	fullName: string;
	combinedString: string;
	color: number;
}

export default class TeamInfo {
	/**
	 * Get the color of a team
	 * @param teamName - The name of the team
	 * @returns The color of the team
	 */
	static async getTeamColor(teamName: string) {
		const team = await resolveTeam(teamName, { full: true });
		const res = team?.colors[0] ?? '#0099ff';
		return res as ColorResolvable;
	}

	static getTeamShortName(teamName: string): string {
		const nameParts = teamName.split(' ');
		return nameParts[nameParts.length - 1];
	}

	/**
	 * @summary Handle parsing of team names and returning the team emoji, or a combination of the team emoji and short name
	 * @description This function can handle a single team name, or an object with both away and home team names.
	 * If a single team is provided, the function will return the team emoji if found, otherwise the team short name.
	 * If an object is provided, the function will return an object with the away and home team emoji if found, otherwise the team short name.
	 * An optional parameter can be provided to return the team short name with the emoji -- For example, `KNICKS` -> `🗽 Knicks`
	 *
	 * Standard output otherwise would be `🗽`
	 */
	static async resolveTeamIdentifier(
		teamName: string,
		options?: TeamShortNameOrEmojiOptions,
	): Promise<string>;

	static async resolveTeamIdentifier(
		teams: {
			away_team: string;
			home_team: string;
		},
		options?: TeamShortNameOrEmojiOptions,
	): Promise<{ away_team: string; home_team: string }>;

	static async resolveTeamIdentifier(
		teamName: string | { away_team: string; home_team: string },
		options?: TeamShortNameOrEmojiOptions,
	): Promise<string | { away_team: string; home_team: string }> {
		if (typeof teamName === 'string') {
			const teamShortName = TeamInfo.getTeamShortName(teamName);
			const teamEmoji = await findEmoji(teamShortName);

			if (options?.nameWithEmoji) {
				return `${teamEmoji} ${teamShortName}`;
			}
			return teamEmoji;
		}

		const { away_team, home_team } = teamName;
		const awayTeamShortName = TeamInfo.getTeamShortName(away_team);
		const homeTeamShortName = TeamInfo.getTeamShortName(home_team);
		const awayTeamEmoji = await findEmoji(awayTeamShortName);
		const homeTeamEmoji = await findEmoji(homeTeamShortName);

		// Both teams must have found an emoji, otherwise we return the short name
		if (awayTeamEmoji && homeTeamEmoji) {
			// Optional
			if (options?.nameWithEmoji) {
				return {
					away_team: `${awayTeamEmoji} ${awayTeamShortName}`,
					home_team: `${homeTeamEmoji} ${homeTeamShortName}`,
				};
			}
			return {
				away_team: awayTeamEmoji,
				home_team: homeTeamEmoji,
			};
		}

		return {
			away_team: awayTeamShortName,
			home_team: homeTeamShortName,
		};
	}

	/**
	 * Get team information including emoji, short name, full name, and combined string
	 * @param teamName The full name of the team
	 * @returns An object containing team information
	 * In the event the emoji is not found, the short name is a fallback.
	 */
	public async getTeamInfo(teamName: string): Promise<GetTeamInfoResponse> {
		const shortName = new StringUtils().getShortName(teamName);
		const emoji = container.client.emojis.cache.find(
			(emoji) => emoji.name?.toLowerCase() === shortName.toLowerCase(),
		);
		const hexColor = (await TeamInfo.getTeamColor(teamName)) as string;
		const parsedHex = Number.parseInt(hexColor.slice(1), 16);
		return {
			emoji: emoji || shortName,
			shortName,
			fullName: teamName,
			combinedString: `${emoji || shortName} ${shortName}`,
			color: parsedHex,
		};
	}
}
