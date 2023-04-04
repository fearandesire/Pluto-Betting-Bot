import puppeteer from 'puppeteer'

/**
 * @module fetchVsImg
 * Use Puppeteer to fetch the image for the game channel.
 * @param {string} searchTerm - The term to search for
 * @returns {string} - The direct image link
 */

export async function fetchVsImg(searchTerm, customSearch) {
	const browser = await puppeteer.launch({
		headless: true,
	})

	const page = await browser.newPage()

	await page.goto(customSearch)

	await page.keyboard.press('Tab')

	// # Type search term
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

	await browser.close()

	return imgUrl || null
}
