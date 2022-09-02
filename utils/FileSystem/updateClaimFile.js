import { LogGreen, LogYellow } from '#LogColor'

import editJsonFile from 'edit-json-file'

var __dirname = './lib'
let file = editJsonFile(`${__dirname}/data.json`)
export function updateClaimFile(userid, claimtime) {
    LogYellow(`[updateClaimFile.js] Updating Claim File`)

    file.set(`${userid}.claimtime`, claimtime)
    file.save()
    LogGreen(`[updateClaimFile.js] Claim File Updated`)
    return
}
