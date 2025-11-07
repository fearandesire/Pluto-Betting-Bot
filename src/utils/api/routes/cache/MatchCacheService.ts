import type { MatchDetailDto } from '@kh-openapi';
import { teamResolver } from 'resolve-team';
import type { CacheManager } from '../../../cache/cache-manager.js';
import MatchApiWrapper from '../../Khronos/matches/matchApiWrapper.js';

export default class MatchCacheService {
	constructor(private cache: CacheManager) {}

	async requestMatches() {
		const data = await new MatchApiWrapper().getAllMatches();
		return data;
	}

	async cacheMatches(matches: MatchDetailDto[]) {
		await this.cache.set('matches', matches, 86400);
		console.log({
			method: this.cacheMatches.name,
			message: 'Match Cache updated successfully.',
		});
	}

	async getMatches() {
		return await this.cache.get('matches');
	}

	async getMatch(matchid: string): Promise<MatchDetailDto | null> {
		const allMatches = await this.getMatches();
		if (!allMatches) {
			return null;
		}
		const match = allMatches.find((match: MatchDetailDto) => match.id === matchid);
		if (!match) {
			return null;
		}
		return match;
	}

	async matchesByTeam(team: string) {
		const resolvedTeamName = await teamResolver.resolve(team, { full: false });
		if (!resolvedTeamName) {
			throw new Error('Unable to identify the sports team you specified');
		}
		// Search match cache and identify matches that contain the team
		const matchCache = await this.getMatches();
		if (!matchCache) {
			throw new Error('Unable to retrieve stored matches at this time.');
		}
		const matches = matchCache.filter((match: MatchDetailDto) => {
			return (
				match.home_team === resolvedTeamName ||
				match.away_team === resolvedTeamName
			);
		});
		return matches;
	}
}
