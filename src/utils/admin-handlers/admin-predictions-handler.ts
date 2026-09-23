import type { AllUserPredictionsDto } from '@pluto-khronos/api-client'
import { container } from '@sapphire/framework'
import type { Subcommand } from '@sapphire/plugin-subcommands'
import {
	fieldsPaginator,
	predictionDeletedEmbed,
	predictionField,
	predictionsTemplateEmbed,
} from '../../lib/discord/builders/admin.js'
import PredictionApiWrapper from '../api/Khronos/prediction/predictionApiWrapper.js'
import PropsApiWrapper from '../api/Khronos/props/props-api-wrapper.js'
import { DateManager } from '../common/DateManager.js'
import TeamInfo from '../common/TeamInfo.js'

/**
 * Handler for admin prediction management commands
 * Handles viewing and deleting user predictions
 */
export class AdminPredictionsHandler {
	/**
	 * Handle /admin predictions view <user>
	 * View all active predictions for a specific user
	 */
	public async handleView(
		interaction: Subcommand.ChatInputCommandInteraction,
	): Promise<void> {
		await interaction.deferReply({ ephemeral: true })

		const user = interaction.options.getUser('user', true)

		try {
			const predictionApiWrapper = new PredictionApiWrapper()
			const activePredictions =
				await predictionApiWrapper.getActivePredictionsForUser({
					userId: user.id,
				})

			if (!activePredictions || activePredictions.length === 0) {
				await interaction.editReply({
					content: `No active predictions found for ${user.username}.`,
				})
				return
			}

			const templateEmbed = predictionsTemplateEmbed(
				user.username,
				user.id,
				activePredictions.length,
			)

			const formattedPredictions = await Promise.all(
				activePredictions.map((prediction) =>
					this.createPredictionField(prediction),
				),
			)

			const paginatedMsg = fieldsPaginator(
				templateEmbed,
				formattedPredictions,
			)

			await paginatedMsg.run(interaction)
		} catch (error) {
			container.logger.error('Error viewing predictions:', error)
			await interaction.editReply({
				content: 'An error occurred while fetching predictions.',
			})
		}
	}

	/**
	 * Handle /admin predictions delete <user> <prediction_id>
	 * Delete a specific prediction for a user
	 */
	public async handleDelete(
		interaction: Subcommand.ChatInputCommandInteraction,
	): Promise<void> {
		await interaction.deferReply({ ephemeral: true })

		const user = interaction.options.getUser('user', true)
		const predictionIdInput = interaction.options.getString(
			'prediction_id',
			true,
		)

		try {
			const predictionApiWrapper = new PredictionApiWrapper()

			// Get all active predictions for the user to find the full UUID
			const activePredictions =
				await predictionApiWrapper.getActivePredictionsForUser({
					userId: user.id,
				})

			if (!activePredictions || activePredictions.length === 0) {
				await interaction.editReply({
					content: `No active predictions found for ${user.username}.`,
				})
				return
			}

			// Find the prediction that matches the input (support both full UUID and last 8 chars)
			const matchedPrediction = activePredictions.find(
				(pred) =>
					pred.id === predictionIdInput ||
					pred.id.slice(-8).toLowerCase() ===
						predictionIdInput.toLowerCase(),
			)

			if (!matchedPrediction) {
				const availableIds = activePredictions
					.map((pred) => `\`${pred.id.slice(-8)}\``)
					.join(', ')
				await interaction.editReply({
					content: `Prediction ID \`${predictionIdInput}\` not found for ${user.username}.\nAvailable IDs: ${availableIds}`,
				})
				return
			}

			// The admin input resolves to the unique prediction UUID, so use the
			// explicit DELETE /prediction/by-id/:prediction_id route.
			await predictionApiWrapper.deletePredictionById({
				predictionId: matchedPrediction.id,
				userId: user.id,
			})

			// Format the prediction details for confirmation
			// Fetch prop to get event_context as fallback for malformed match_string
			const propApiWrapper = new PropsApiWrapper()
			const prop = await propApiWrapper.getPropByUuid(
				matchedPrediction.outcome_uuid,
			)
			const parsedMatchString = await this.parseMatchString(
				matchedPrediction.match_string,
				prop.event_context,
			)
			const date = new DateManager().toMMDDYYYY(
				matchedPrediction.created_at,
			)

			const confirmEmbed = predictionDeletedEmbed({
				id: matchedPrediction.id,
				username: user.username,
				userId: user.id,
				match: parsedMatchString,
				choice: matchedPrediction.choice,
				date,
			})

			await interaction.editReply({
				embeds: [confirmEmbed],
			})
		} catch (error: any) {
			container.logger.error('Error deleting prediction:', error)

			// Handle specific errors from the API
			if (error.response?.status === 404) {
				await interaction.editReply({
					content:
						"Prediction not found or doesn't belong to this user.",
				})
				return
			}
			if (error.response?.status === 400) {
				await interaction.editReply({
					content:
						'Cannot delete this prediction. The event may have already started or the prediction has been processed.',
				})
				return
			}

			await interaction.editReply({
				content: 'An error occurred while deleting the prediction.',
			})
		}
	}

	/**
	 * Create a formatted field for a prediction
	 */
	private async createPredictionField(
		prediction: AllUserPredictionsDto,
	): Promise<{ name: string; value: string; inline: boolean }> {
		// Get Prop via ID within the prediction
		const propApiWrapper = new PropsApiWrapper()
		const prop = await propApiWrapper.getPropByUuid(prediction.outcome_uuid)

		// Find the specific outcome that matches the prediction
		const outcome = prop.outcomes.find(
			(o) => o.outcome_uuid === prediction.outcome_uuid,
		)

		// Parse match string with fallback to event_context if match_string is malformed
		const parsedMatchString = await this.parseMatchString(
			prediction.match_string,
			prop.event_context,
		)

		// Format date
		const date = new DateManager().toMMDDYYYY(prediction.created_at)

		return predictionField({
			id: prediction.id,
			choice: prediction.choice,
			point: outcome?.point,
			marketKey: prop.market_key,
			outcomeDescription: outcome?.description,
			match: parsedMatchString,
			date,
		})
	}

	/**
	 * Parse and format match string with team identifiers
	 * @param matchString - The match string to parse (e.g., "Team A vs. Team B")
	 * @param fallbackContext - Optional fallback event context if match_string is malformed
	 */
	private async parseMatchString(
		matchString: string | null | undefined,
		fallbackContext?: {
			away_team: string
			home_team: string
		},
	): Promise<string> {
		// Validate match_string exists and contains the expected separator
		if (!matchString || !matchString.includes(' vs. ')) {
			// Use fallback if available
			if (fallbackContext) {
				const result = await TeamInfo.resolveTeamIdentifier({
					away_team: fallbackContext.away_team,
					home_team: fallbackContext.home_team,
				})
				return `${result.away_team} vs. ${result.home_team}`
			}
			// If no fallback, return original string or a safe default
			return matchString || 'Unknown Match'
		}

		const parts = matchString.split(' vs. ')
		const awayTeam = parts[0]?.trim()
		const homeTeam = parts[1]?.trim()

		// Validate that both teams were extracted correctly
		if (!awayTeam || !homeTeam) {
			// Use fallback if available
			if (fallbackContext) {
				const result = await TeamInfo.resolveTeamIdentifier({
					away_team: fallbackContext.away_team,
					home_team: fallbackContext.home_team,
				})
				return `${result.away_team} vs. ${result.home_team}`
			}
			// If no fallback, return original string
			return matchString
		}

		const result = await TeamInfo.resolveTeamIdentifier({
			away_team: awayTeam,
			home_team: homeTeam,
		})

		return `${result.away_team} vs. ${result.home_team}`
	}
}
