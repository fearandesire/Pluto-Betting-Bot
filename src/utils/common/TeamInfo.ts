import type { ColorResolvable } from 'discord.js';
import { resolveTeam } from 'resolve-team';
export default class TeamInfo {
	static async getTeamColor(teamName: string) {
		const team = await resolveTeam(teamName, { full: true });
		const res = team?.colors[0] ?? '#0099ff';
		return res as ColorResolvable;
	}

	static getTeamShortName(teamName: string): string {
		const nameParts = teamName.split(' ');
		return nameParts[nameParts.length - 1];
	}
}
