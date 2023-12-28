import db from '@pluto-db'
import { LIVEMATCHUPS } from '@pluto-server-config'

export default class ScheduledChannelsManager {
	static async setScheduled(scheduledDataArr) {
		// Loop arr, update DB row via matching ID - Set `scheduled` to true, `scheduled_cron` to the prop `scheduled_cron` value in the arr
		await db.tx(`setScheduled`, async (t) => {
			for (
				let i = 0;
				i < scheduledDataArr.length;
				i += 1
			) {
				const { id, scheduled_cron } =
					scheduledDataArr[i]
				await t.none(
					`UPDATE "${LIVEMATCHUPS}" SET scheduled = true, scheduled_cron = $1 WHERE id = $2`,
					[scheduled_cron, id],
				)
			}
			await console.log(
				`Saved scheduled times into DB`,
			)
			return true
		})
	}
}
