import test from 'ava'
import dotenv from 'dotenv'
import { db } from '#db'

import generateCronJobs from '../utils/api/generateCronJobs.js'

dotenv.config()

test('generateCronJobs returns true on success', async (t) => {
    const todaysMatches = [
        {
            teamOne: 'Boston Celtics',
            teamTwo: 'Golden State Warriors',
            startTime: '2023-02-25T22:00:00.000Z',
        },
        {
            teamOne: 'Cleveland Cavaliers',
            teamTwo: 'Toronto Raptors',
            startTime: '2023-02-26T04:55:00.000Z',
        },
    ]

    const result = await generateCronJobs(true, todaysMatches)

    // # Ensure result is an object
    t.true(typeof result === 'object')
    // # Ensure we have `range1` and `range2` properties which both should be strings
    t.true(typeof result.range1 === 'string')
    t.true(typeof result.range2 === 'string')
})
