import test from 'ava'
import dotenv from 'dotenv'
import { fetchGif } from '../utils/bot_res/fetchGif.js'

// Load environment variables from .env file
dotenv.config()

test('fetchGif returns a direct image link for a random gif', async (t) => {
    const term = 'Atlanta'
    const result = await fetchGif(term)
    t.true(typeof result === 'string')
    t.true(result.startsWith('https://'))
})
