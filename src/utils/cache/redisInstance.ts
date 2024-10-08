import { bold, green, yellow } from 'colorette';
import { default as Redis } from 'ioredis'; // Issue from https://github.com/redis/ioredis/issues/1624

const { R_HOST, R_PORT, R_PASS, R_DB } = process.env;

console.log(yellow(`Connecting to Redis: ${R_HOST}:${R_PORT}`));

const MAX_RETRY_ATTEMPTS = 2; // Set the maximum number of retry attempts
// @ts-ignore
const redisCache = new Redis({
	host: R_HOST,
	port: Number(R_PORT),
	password: R_PASS,
	connectTimeout: 10000,
	retryStrategy: (times) => {
		if (times >= MAX_RETRY_ATTEMPTS) {
			throw new Error('Max retry attempts reached');
		}
		return Math.min(2 ** times * 1000, 60000);
	},
	db: Number(R_DB),
});

redisCache.on('connect', () => {
	console.log(
		bold(green(`[REDIS] Connected to Redis server\nDB Selection: ${R_DB}`)),
	);
});

redisCache.on('error', (err) => {
	console.error(err);
	process.exit(1);
});

export default redisCache;
