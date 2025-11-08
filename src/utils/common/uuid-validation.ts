/**
 * UUID validation utilities
 * Supports both standard UUID format (with dashes) and normalized format (without dashes)
 */

/**
 * UUID regex pattern: accepts both formats
 * Standard: 8-4-4-4-12 hex digits (e.g., 550e8400-e29b-41d4-a716-446655440000)
 * Normalized: 32 hex digits (e.g., 550e8400e29b41d4a716446655440000)
 */
export const UUID_REGEX =
	/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

/**
 * Validate if a string is a valid UUID format (with or without dashes)
 * @param uuid - The string to validate
 * @returns true if the string is a valid UUID format, false otherwise
 */
export function isValidUUID(uuid: string): boolean {
	if (!uuid || typeof uuid !== 'string') return false
	return UUID_REGEX.test(uuid)
}
