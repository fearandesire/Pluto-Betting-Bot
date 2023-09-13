import test from 'ava'
import cronCompletedChecks from '../utils/bot_res/cronCompletedChecks.js'

test('generate Cron Job String based on array', async (t) => {
	const datesArr = [
		'2023-09-12T19:00:00.297Z',
		'2023-09-12T19:30:00.297Z',
		'2023-09-12T20:00:00.297Z',
		'2023-09-12T20:30:00.297Z',
		'2023-09-12T21:00:00.297Z',
		'2023-09-12T21:30:00.297Z',
		'2023-09-12T22:00:00.297Z',
	]
	// const cronString = await cronCompletedChecks(datesArr)
	// console.log(cronString)
	// Pass test as long as it returns a string
})
