import puppeteer from 'puppeteer-extra'
import fs from 'fs'
import path from 'path'
import { packageDirectory } from 'pkg-dir'
import pluginStealth from 'puppeteer-extra-plugin-stealth'
import _ from 'lodash'
// Save the executable path
import { executablePath } from 'puppeteer'

const customGoogle = `https://cse.google.com/cse?cx=d284f66fca4474ec0`
const rootDir = await packageDirectory()

// Use stealth
puppeteer.use(pluginStealth())

// Array of NFL team names (short names)
const nflTeams = [
	'Eagles',
	'Bills',
	'Dolphins',
	'Jets',
	'Ravens',
	'Bengals',
	'Browns',
	'Steelers',
	'Texans',
	'Colts',
	'Jaguars',
	'Titans',
	'Broncos',
	'Chiefs',
	'Raiders',
	'Chargers',
	'Cowboys',
	'Giants',
	'Redskins',
	'Eagles',
	'Bears',
	'Lions',
	'Packers',
	'Vikings',
	'Falcons',
	'Panthers',
	'Saints',
	'Buccaneers',
	'Cardinals',
	'Rams',
	'49ers',
	'Seahawks',
	'Patriots',
]

await matchupsFetch()

async function matchupsFetch() {
	const matchupStrings = await genMatchupArr(nflTeams)

	for await (const matchup of matchupStrings) {
		// console.log(
		// 	`Fetching matchup images for ${matchup}`,
		// )
		try {
			const strFormat = matchup.replace(/ /g, '_')
			// Check if existing
			const exists = await checkFileExists(strFormat)
			if (exists === true) {
				continue
			}
			await reqVsImg(matchup, customGoogle)
		} catch (err) {
			await console.log(
				`Capctha block...restarting in 10 minutes`,
			)
			await setTimeout(async () => {
				await reqVsImg(matchup, customGoogle)
			}, 800000)
			return
		}
	}
}

// Function to generate arr of matchup strings

async function genMatchupArr(teams) {
	const matchups = _.flatMap(teams, (teamA, indexA) =>
		_.map(
			_.slice(teams, indexA + 1),
			(teamB) => `${teamA} vs ${teamB}`,
		),
	)
	return matchups
}
async function checkFileExists(fileName) {
	const filePath = `${rootDir}/lib/matchupimages/nfl/${fileName}.jpg`
	// console.log(`Checking ${fileName} @ ${filePath}`)
	const exists = fs.existsSync(filePath)
	// console.log(`Exists: ${exists}`)
	return exists
}
/**
 * Retrieves an image of a search term from a custom search.
 *
 * @param {string} searchTerm - The term to search for.
 * @param {string} customSearch - The URL of the custom search.
 * @return {Promise<void>} - Resolves when the image is saved to the specified folder.
 */
export async function reqVsImg(searchTerm, customSearch) {
	const browser = await puppeteer.launch({
		headless: true,
	})

	try {
		const page = (await browser.pages())[0]
		await page.goto(customSearch)

		await page.keyboard.press('Tab')

		// Type search term
		await page.keyboard.type(`${searchTerm} ESPN`)

		await page.keyboard.press('Enter')
		await page.waitForTimeout(1000)

		await page.click(
			`#___gcse_0 > div > div > div > div.gsc-wrapper > div.gsc-resultsbox-visible > div.gsc-resultsRoot.gsc-tabData.gsc-tabdActive > div > div.gsc-expansionArea > div:nth-child(1) > div.gs-result.gs-imageResult.gs-imageResult-popup > div.gs-image-thumbnail-box > div`,
		)

		const imgUrl = await page.evaluate(() => {
			const img = document.querySelector(
				`#___gcse_0 > div > div > div > div.gsc-wrapper > div.gsc-resultsbox-visible > div.gsc-resultsRoot.gsc-tabData.gsc-tabdActive > div > div.gsc-expansionArea > div.gsc-imageResult.gsc-imageResult-popup.gsc-result.gs-selectedImageResult > div.gs-imagePreviewArea > a > img`,
			)
			return img.getAttribute('src')
		})
		if (imgUrl) {
			const imgExtension = `.jpg`
			let imgFileName = `${searchTerm.replace(
				/\s/g,
				'_',
			)}${imgExtension}`

			// Replace 'at' with 'vs'
			imgFileName = imgFileName.replace(/at/g, 'vs')

			const imgPath = path.join(
				`${await packageDirectory()}/lib/matchupimages/nfl/${imgFileName}`,
			)

			// Save the image to the specified folder
			const imageBuffer = await fetch(imgUrl).then(
				(response) => response.arrayBuffer(),
			)

			await fs.writeFileSync(
				imgPath,
				Buffer.from(imageBuffer),
			)
			await console.log(
				`Saved image for matchup ${searchTerm}`,
			)
		} else {
			await console.log(
				`No IMG found for ${searchTerm}`,
			)
		}
		await browser.close()
	} catch (err) {
		await browser.close()
		throw err
	}
}

/**
 * Retrieves the matchup images for all NFL teams.
 *
 * @return {Promise<void>} This function does not return anything.
 */
export async function getMatchupImgs() {
	const allMatchups = await genMatchupArr(nflTeams)

	for await (const term of allMatchups) {
		console.log(`Fetching matchup images for ${term}`)
		try {
			await reqVsImg(term, process.env.GOOGLE_CUSTOM)
		} catch (err) {
			console.error(
				`Error fetching matchup images for ${term}: ${err}`,
			)
			throw err
		}
	}
}
