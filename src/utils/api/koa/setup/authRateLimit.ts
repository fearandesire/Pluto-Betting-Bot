import type { Context } from 'koa';
import redisCache from '../../../cache/redis-instance.js';
import { WinstonLogger } from '../../../logging/WinstonLogger.js';

const MAX_FAILED_ATTEMPTS = 5;
const BAN_DURATION = 60 * 60; // 1 hour in seconds

/**
 * Handles rate limiting and IP banning for authentication attempts
 */
export class AuthRateLimit {
	private getFailedAttemptsKey(ip: string): string {
		return `auth:failed:${ip}`;
	}

	private getBanKey(ip: string): string {
		return `auth:banned:${ip}`;
	}

	private isLocalhost(ip: string): boolean {
		return (
			ip === '127.0.0.1' ||
			ip === '::1' ||
			ip === 'localhost' ||
			ip.startsWith('::ffff:127.0.0.1')
		);
	}

	/**
	 * Checks if an IP is banned
	 */
	async isBanned(ip: string): Promise<boolean> {
		if (this.isLocalhost(ip)) {
			return false;
		}
		const banKey = this.getBanKey(ip);
		const isBanned = await redisCache.exists(banKey);
		return isBanned === 1;
	}

	/**
	 * Records a failed authentication attempt and bans the IP if it exceeds the limit
	 */
	async recordFailedAttempt(ip: string): Promise<void> {
		if (this.isLocalhost(ip)) {
			return;
		}
		const attemptsKey = this.getFailedAttemptsKey(ip);
		const banKey = this.getBanKey(ip);

		// Increment failed attempts counter
		const attempts = await redisCache.incr(attemptsKey);

		// Set expiry for the attempts counter if it's new
		if (attempts === 1) {
			await redisCache.expire(attemptsKey, BAN_DURATION);
		}

		// Ban IP if it exceeds max attempts
		if (attempts >= MAX_FAILED_ATTEMPTS) {
			await redisCache.setex(banKey, BAN_DURATION, '1');
			WinstonLogger.warn({
				message: 'IP banned due to too many failed authentication attempts',
				ip,
				attempts,
			});
		}
	}

	/**
	 * Resets the failed attempts counter for an IP
	 */
	async resetAttempts(ip: string): Promise<void> {
		const attemptsKey = this.getFailedAttemptsKey(ip);
		await redisCache.del(attemptsKey);
	}

	/**
	 * Middleware to check if an IP is banned before proceeding
	 */
	middleware() {
		return async (ctx: Context, next: () => Promise<void>) => {
			const ip = ctx.ip;

			if (await this.isBanned(ip)) {
				ctx.status = 403;
				ctx.body = {
					error: 'Access restricted.',
				};
				return;
			}

			await next();
		};
	}
}
