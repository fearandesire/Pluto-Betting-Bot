import { QuickError, embedReply } from '#embed'

import { db } from '#db'
import { CURRENCY, helpfooter } from '#config'
import PlutoLogger from '#PlutoLogger'
import embedColors from '../../lib/colorsConfig.js'
import { TodaysDate } from '../date/TodaysDate.js'

/**
 * Create a new user in the database. By default, we will store their userID (required) and their default balance: 100 (optional)
 * Balance is an optional argument as the default value of 'balance' will be set to 100.
 * @param {integer | string} userid - The ID of the user to be created.
 */

export async function registerUser(
	interaction,
	userid,
	inform,
) {
	try {
		await db.tx(
			`registerUser-Transaction`,
			async (t) => {
				const findUser = await t.oneOrNone(
					`SELECT * FROM "${CURRENCY}" WHERE userid = $1`,
					[userid],
				)
				if (!findUser) {
					await t.any(
						`INSERT INTO "${CURRENCY}" (userid, balance, registerdate) VALUES ($1, $2, $3) RETURNING *`,
						[userid, '50', TodaysDate()],
					)
					const embedObj = {
						title: `Welcome to Pluto! 🎉`,
						description: `You  will start with $50.\nUse the command **/commands** to see everything you can do, or use **/help** for a quick general how-to.\n*Tip: You can use **\`/dailyclaim\`** to get bonus $$ everyday!*`,
						color: `${embedColors.PlutoGreen}`,
						footer: `${helpfooter}`,
						silent: true,
					}
					await embedReply(interaction, embedObj)
					return
				}
				if (inform === true) {
					QuickError(
						interaction,
						`You are already registered!`,
						true,
					)
				}
			},
		)
	} catch (error) {
		await PlutoLogger.log({
			id: 4,
			description: `Error occured when registering user => \`${userid}\`\nError: \`${
				error?.message || error
			}\``,
		})
	}
}
