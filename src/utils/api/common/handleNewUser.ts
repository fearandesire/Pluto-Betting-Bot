import type {
	DoubleDownDto,
	GetBalanceDto,
	GetProfileDto,
	InitBetslipRespDTO,
	PlacedBetslipDto,
} from '@kh-openapi'
import { container } from '@sapphire/framework'
import { CacheManager } from '../../cache/cache-manager.js'
import { logger } from '../../logging/WinstonLogger.js'
import { NewUserDetectionService } from './NewUserDetectionService.js'
import { WelcomeMessageService } from './WelcomeMessageService.js'

/**
 * Service class for orchestrating new user detection and welcome message sending.
 * Holds service dependencies to avoid per-call instantiation.
 * Initializes services upfront in constructor (fail-fast if client unavailable).
 */
class NewUserService {
	private readonly cacheManager: CacheManager
	private readonly welcomeService: WelcomeMessageService

	constructor() {
		this.cacheManager = new CacheManager()

		// Fail-fast if client is not ready
		const client = container.client
		if (!client || !client.isReady()) {
			throw new Error(
				'Discord client must be ready before service initialization',
			)
		}

		this.welcomeService = new WelcomeMessageService(
			client,
			this.cacheManager,
		)
	}

	/**
	 * Detects and handles new users from API responses.
	 * Fire-and-forget pattern - does not block execution.
	 * @param response - API response that may contain isNewUser flag
	 */
	handleNewUser(
		response:
			| GetProfileDto
			| GetBalanceDto
			| InitBetslipRespDTO
			| PlacedBetslipDto
			| DoubleDownDto,
	): void {
		try {
			const result = NewUserDetectionService.detectNewUser(response)

			if (!result) {
				return
			}

			if ('validationErrors' in result) {
				const errors = result.validationErrors
				logger.warn({
					message:
						'Failed to detect new user - schema validation failed',
					source: 'NewUserService',
					directErrors: errors.direct?.issues?.length ?? 0,
					betslipDataErrors: errors.betslipData?.issues?.length ?? 0,
				})
				return
			}

			this.welcomeService.sendWelcomeMessage(result.userId).catch(() => {
				// Errors are already logged by WelcomeMessageService
			})
		} catch (error) {
			logger.debug({
				message: 'Error in new user detection',
				error: error instanceof Error ? error.message : String(error),
				source: 'NewUserService',
			})
		}
	}
}

// Lazy singleton instance - initialized on first use
let service: NewUserService | null = null

/**
 * Gets or creates the service singleton.
 * Initializes lazily to avoid failing at module load time.
 */
function getService(): NewUserService {
	if (!service) {
		service = new NewUserService()
	}
	return service
}

/**
 * Helper function to detect and handle new users from API responses.
 * Fire-and-forget pattern - does not block execution.
 * @param response - API response that may contain isNewUser flag
 */
export function handleNewUser(
	response:
		| GetProfileDto
		| GetBalanceDto
		| InitBetslipRespDTO
		| PlacedBetslipDto
		| DoubleDownDto,
): void {
	try {
		getService().handleNewUser(response)
	} catch (error) {
		logger.debug({
			message: 'Skipping welcome message - service not initialized',
			error: error instanceof Error ? error.message : String(error),
			source: 'handleNewUser',
		})
	}
}
