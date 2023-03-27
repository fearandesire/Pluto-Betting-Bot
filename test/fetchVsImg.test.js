/* eslint-disable mocha/no-global-tests */

import test from 'ava'
// import dotenv from 'dotenv'
import { fetchVsImg } from '../utils/bot_res/fetchVsImg.js'

// Load environment variables from .env file
// dotenv.config()

test('fetchVsImg returns a direct image link for team vs team', async (t) => {
    const term = 'Celtics vs Warriors'
    const result = await fetchVsImg(term)
    console.log(`Res ->\n`, result)
    t.true(typeof result === 'string')
    t.true(result.startsWith('http://'))
    // # Ensure image source is from ESPN
    t.true(result.includes('espncdn'))
})

