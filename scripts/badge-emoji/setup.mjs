import { runEmojiSetup } from './lib.mjs'

process.exitCode = await runEmojiSetup({
	fetch: globalThis.fetch,
	env: process.env,
	argv: process.argv.slice(2),
})
