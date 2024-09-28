import type { ColorResolvable } from 'discord.js';
import { resolveTeam } from 'resolve-team';
export default class TeamInfo {
	static getTeamColor(teamName: string) {
		const team = resolveTeam(teamName, { full: true });
		const res = team?.colors[0] ?? '#0099ff';
		return res as ColorResolvable;
	}
}
