import type { SportsServing } from '@pluto-khronos/types'
import { teamResolver } from 'resolve-team'
import { createLogger } from '../logging/WinstonLogger.js'

const log = createLogger({ component: 'game', handler: 'handle-gm' })

export interface LocatedTeam {
	name: string
	sport: SportsServing
}

/**
 * Handles game-management operations: resolving team identities,
 * validating game state, and co-ordinating match-lifecycle events.
 */
export class GmHandler {
	/**
	 * Resolve a raw team string (abbreviation, nickname, or full name) to a
	 * canonical team record for the given sport.
	 *
	 * @throws {Error} When the team cannot be resolved.
	 */
	async locateTeam(
		rawTeam: string,
		sport: SportsServing,
	): Promise<LocatedTeam> {
		try {
			const resolved = await teamResolver.resolve(rawTeam, {
				sport,
				full: true,
			})

			if (!resolved || !resolved.name) {
				throw new Error(`Team "${rawTeam}" could not be resolved for sport "${sport}"`)
			}

			log.info('Team located', {
				event: 'game.team_located',
				rawTeam,
				sport,
				resolvedName: resolved.name,
			})

			return { name: resolved.name, sport }
		} catch (error) {
			log.error('GmHandler.locateTeam: Failed to locate team', {
				event: 'game.team_locate_failed',
				rawTeam,
				sport,
				error,
			})
			throw error
		}
	}

	/**
	 * Validate that a pair of team names are distinct and non-empty.
	 *
	 * @throws {Error} When home and away resolve to the same team.
	 */
	validateMatchup(homeTeam: string, awayTeam: string): void {
		if (!homeTeam || !awayTeam) {
			throw new Error('Both home and away team names are required')
		}
		if (homeTeam.toLowerCase() === awayTeam.toLowerCase()) {
			throw new Error(`Home and away teams must differ — got "${homeTeam}" for both`)
		}
	}
}

export const gmHandler = new GmHandler()
