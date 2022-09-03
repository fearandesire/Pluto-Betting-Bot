import { Log, LogGreen } from '#LogColor'

import editJsonFile from 'edit-json-file'

var __dirname = './lib'
let file = editJsonFile(`${__dirname}/data.json`)
export function updateClaimFile(userid, claimtime) {
	Log.Yellow(`[updateClaimFile.js] Updating Claim File`)

	file.set(`${userid}.claimtime`, claimtime)
	file.save()
	LogGreen(`[updateClaimFile.js] Claim File Updated`)
	return
}
