/**
 * Khronos API Services
 *
 * Service layer exports for Khronos API integrations
 */

export type { FooterServiceConfig } from './FooterService.js'
export { createFooterService, FooterService } from './FooterService.js'

export {
	ApiErrorCategory,
	ApiServiceError,
	err,
	type HttpErrorMetadata,
	ok,
	type Result,
} from './types/api-errors.js'

export {
	calculateBackoffDelay,
	classifyError,
	createApiServiceError,
	isRetriableCategory,
	type RetryConfig,
	withRetry,
} from './utils/retry.js'
