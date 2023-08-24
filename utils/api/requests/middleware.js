import bodyParser from 'body-parser'
import express from 'express'
import { createRequire } from 'module'
import { Log } from '#config'
import resolveRanges from '../ranges/resolveRanges.js'
import fetchRanges from '../ranges/fetchRanges.js'
import collectOdds from '../collectOdds.js'

// use require in ES6
const require = createRequire(import.meta.url)
const app = express()

export async function startExpress() {
	app.use(require('express-status-monitor')())
	app.use(bodyParser.json()) // for parsing application/json
	app.use(
		bodyParser.urlencoded({
			extended: true,
		}),
	) // for parsing application/x-www-form-urlencoded

	// # Create a simple test route
	app.get('/api/test', (req, res) => {
		res.send('Hello World!')
	})

	app.listen(process.env.EXP_PORT, () => {
		Log.Green(
			`[Startup]: Init Express Server\nPort: ${process.env.EXP_PORT}!`,
		)
	})

	// # Handle request for ranges
	app.get('/api/ranges', async (req, res) => {
		try {
			const ranges = await fetchRanges()
			const output = await resolveRanges(ranges, {
				api: true,
			})
			res.send(output)
		} catch (err) {
			Log.Red(err)
			res.status(404).send(
				'Error occured while resolving ranges',
			)
		}
	})

	app.get('/api/collect', async (req, res) => {
		await console.log(
			`[API]: Odds collection request received`,
		)
		res.send('Odds successfully collected')
		// await console.log(
		// 	`[API]: Odds collection request received`,
		// )
		// const odds = await collectOdds()
		// if (odds) {
		// 	res.send('Odds successfully collected')
		// } else {
		// 	res.send('Failed to collect odds')
		// }
	})
}
