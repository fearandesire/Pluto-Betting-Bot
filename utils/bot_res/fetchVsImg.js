/* eslint-disable prefer-promise-reject-errors */
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'node:url'
import PlutoLogger from '#PlutoLogger'

/**
 * @module fetchVsImg
 * @summary Retrieve local image file for the matchup.
 * @param {string} matchup - The matchup to retrieve the image for
 * @returns {Promise<Buffer>} A promise that resolves with the image data as a Buffer
 */

export async function fetchVsImg(matchup) {
	// Replace spaces with underscores in the matchup string
	const matchupFileName = `${matchup.replace(
		/\s/g,
		'_',
	)}.jpg`

	// Get the directory path of the current module
	const moduleDir = path.dirname(
		fileURLToPath(import.meta.url),
	)

	try {
		// Construct the path to the matchup image file
		const imagePath = path.join(
			moduleDir,
			'../../',
			'lib',
			'matchupimages',
			`${process.env.SPORT}`,
			matchupFileName,
		)

		// Read the image file as a binary buffer
		const imageBuffer = await fs.readFile(imagePath)

		return imageBuffer
	} catch (error) {
		await PlutoLogger.log({
			id: 4,
			description: `Error fetching ${matchup} image: ${error.message}`,
		})
		return false
	}
}
