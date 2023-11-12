import { RateLimitManager } from '@sapphire/ratelimits'

const allOddsMngr = new RateLimitManager(5000, 2)

export const allOddsRL = allOddsMngr.acquire(
	`all-odds-ratelimit`,
)
