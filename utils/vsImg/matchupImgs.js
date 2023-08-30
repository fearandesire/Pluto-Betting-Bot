import puppeteer from 'puppeteer-extra'
import fs from 'fs'
import path from 'path'
import { packageDirectory } from 'pkg-dir'
import pluginStealth from 'puppeteer-extra-plugin-stealth'

// Save the executable path
import { executablePath } from 'puppeteer'

// Use stealth
puppeteer.use(pluginStealth())

// Array of NFL team names (short names)
const nflTeams = [
	'Eagles',
	'Patriots',
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
]

// Function to generate arr of matchup strings
async function genMatchupArr(teams) {
	const matchups = []
	for (let i = 0; i < teams.length - 1; i += 1) {
		for (let j = i + 1; j < teams.length; j += 1) {
			matchups.push(`${teams[i]} vs ${teams[j]}`)
		}
	}
	return matchups
}
export async function reqVsImg(searchTerm, customSearch) {
	const browser = await puppeteer.launch({
		headless: true,
	})

	const page = await browser.newPage()

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
		const imgFileName = `${searchTerm.replace(
			/\s/g,
			'_',
		)}${imgExtension}`
		const imgPath = path.join(
			`${await packageDirectory()}/lib/matchupimages/nfl/${imgFileName}`,
		)

		// Save the image to the specified folder
		const imageBuffer = await fetch(imgUrl).then(
			(response) => response.arrayBuffer(),
		)

		fs.writeFileSync(imgPath, Buffer.from(imageBuffer))
	} else {
		console.log(`No IMG found for ${searchTerm}`)
	}
	await browser.close()
}

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
