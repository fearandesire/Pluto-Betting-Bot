import puppeteer from 'puppeteer'

/**
 * @module fetchVsImg
 * Use Puppeteer to fetch the image for the game channel.
 * @param {string} searchTerm - The term to search for
 * @returns {string} - The direct image link
 */

export async function fetchVsImg(searchTerm) {
	// Launching a new browser instance with puppeteer
	const browser = await puppeteer.launch({
		headless: true,
		args: ['--no-sandbox'],
	})

	// Opening a new page in the browser
	const page = await browser.newPage()

	// Navigating to the Google Images website
	await page.goto('https://www.google.com/imghp')

	// Typing the search term into the search box and clicking the "Search" button
	await page.type(
		'body > div.L3eUgb > div.o3j99.ikrT4e.om7nvf > form > div:nth-child(1) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > div',
		`${searchTerm} ESPN`,
	)
	await page.keyboard.press('Enter')
	const firsResSelector = `#islrg > div.islrc > div:nth-child(2) > a.wXeWr.islib.nfEiy > div.bRMDJf.islir`
	// Waiting for the results to load
	await page.waitForSelector(firsResSelector, { timeout: 50000 })

	// # Click the first result
	await page.click(firsResSelector)
	// Adding a short delay to ensure the image has fully loaded

	// Wait for the image to fully load
	await page.waitForTimeout(2000)

	await page.waitForSelector(
		`#Sva75c > div.DyeYj > div > div.dFMRD > div.pxAole > div.tvh9oe.BIB1wf > c-wiz > div > div.OUZ5W > div.zjoqD > div.qdnLaf.isv-id.b0vFpe > div > a > img`,
		{ timeout: 5000 },
	)
	// Retrieving the URL of the image
	const imgUrl = await page.evaluate(async () => {
		const getImage = await document
			.querySelector(
				'#Sva75c > div.DyeYj > div > div.dFMRD > div.pxAole > div.tvh9oe.BIB1wf > c-wiz > div > div.OUZ5W > div.zjoqD > div.qdnLaf.isv-id.b0vFpe > div > a > img',
			)
			.getAttribute('src')
		return getImage
	})

	// Closing the browser
	await browser.close()

	// Returning the image URL (or null if no compatible/matching result was found)
	return imgUrl
}
