import test from 'ava'
import resolveRanges from '../utils/api/ranges/resolveRanges.js'

test('resolveRange should resolve cron ranges to legible format', async (t) => {
	const ranges = ['*/5 15-18 16 4 *', '*/5 19-22 18 4 *']
	const expectedOutput =
		'Sunday | 3:00 PM - 6:59 PM\nTuesday | 7:00 PM - 10:59 PM'

	const output = await resolveRanges(ranges)

	t.is(output, expectedOutput)
})
