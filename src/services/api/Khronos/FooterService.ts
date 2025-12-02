/**
 * Footer Service
 *
 * Service layer for footer API operations with retry logic,
 * exponential backoff, and typed error handling.
 */

import { type FooterConfigResponseDto, FootersApi } from '@kh-openapi'
import type { Logger } from 'winston'
import type { Configuration } from '../../../openapi/khronos/index.js'
import { ApiServiceError, err, ok, type Result } from './types/api-errors.js'
import { type RetryConfig, withRetry } from './utils/retry.js'

/**
 * Configuration for FooterService
 */
export interface FooterServiceConfig {
	/** API configuration for Khronos */
	apiConfig: Configuration
	/** Winston logger instance */
	logger: Logger
	/** Optional retry configuration overrides */
	retryConfig?: Partial<RetryConfig>
}

/**
 * Service for fetching footer configuration from Khronos API
 *
 * Features:
 * - Exponential backoff with jitter for transient failures
 * - Honors Retry-After header for 429 responses
 * - Differentiates error types (network, 4xx, 5xx)
 * - Returns Result type for explicit error handling
 */
export class FooterService {
	private readonly footersApi: FootersApi
	private readonly logger: Logger
	private readonly retryConfig: Partial<RetryConfig>
	private readonly serviceName = 'FooterService'

	constructor(config: FooterServiceConfig) {
		this.footersApi = new FootersApi(config.apiConfig)
		this.logger = config.logger
		this.retryConfig = config.retryConfig ?? {}
	}

	/**
	 * Get the footer configuration for consumers
	 *
	 * Returns active announcement (if any) and all active footers grouped by category.
	 * Uses retry logic with exponential backoff for transient failures.
	 *
	 * @returns Result containing FooterConfigResponseDto on success, or ApiServiceError on failure
	 */
	async getFooterConfig(): Promise<Result<FooterConfigResponseDto>> {
		const source = `${this.serviceName}.getFooterConfig`

		try {
			const config = await withRetry(
				() => this.footersApi.getFooterConfig(),
				source,
				this.retryConfig,
			)
			return ok(config)
		} catch (error) {
			// Error is already an ApiServiceError from withRetry
			if (error instanceof ApiServiceError) {
				this.logger.error({
					message: 'Failed to fetch footer config from Khronos',
					metadata: {
						source,
						...error.toLogMetadata(),
					},
				})
				return err(error)
			}

			// Unexpected error type - should not happen but handle gracefully
			const unexpectedError = new ApiServiceError({
				message:
					error instanceof Error
						? error.message
						: 'Unknown error occurred',
				category: await import('./types/api-errors.js').then(
					(m) => m.ApiErrorCategory.Unknown,
				),
				isRetriable: false,
				originalError: error instanceof Error ? error : null,
				source,
			})

			this.logger.error({
				message: 'Unexpected error fetching footer config',
				metadata: {
					source,
					...unexpectedError.toLogMetadata(),
				},
			})

			return err(unexpectedError)
		}
	}
}

/**
 * Creates a FooterService instance with default configuration
 *
 * @param apiConfig - Khronos API configuration
 * @param logger - Winston logger instance
 * @param retryConfig - Optional retry configuration overrides
 */
export function createFooterService(
	apiConfig: Configuration,
	logger: Logger,
	retryConfig?: Partial<RetryConfig>,
): FooterService {
	return new FooterService({
		apiConfig,
		logger,
		retryConfig,
	})
}
