import test from 'ava'
// import dotenv from 'dotenv'

import cronRangeGenerator from '../utils/api/cronRangeGenerator.js'

// dotenv.config()

test('generateCronJobs returns true on success', async (t) => {
	const matchesArr = [
		{
			startTime: '2023-04-03T21:30:00.000Z', // 5:30 PM
		},
		{
			startTime: '2023-04-04T00:15:00.000Z', // 8:15 PM
		},
		{
			startTime: '2023-04-04T01:30:00.000Z', // 9:30 PM
		},
		{
			startTime: '2023-04-04T02:50:00.000Z', // 10:50 PM
		},
	]

	const result = await cronRangeGenerator(matchesArr)
	console.log(`Test Result:\n`, result)
	// # Ensure result is an object
	t.true(typeof result === 'object')
	// # Ensure we have `range1` and `range2` properties which both should be strings
	t.true(typeof result.range1 === 'string')
	t.true(typeof result.range2 === 'string')
})
