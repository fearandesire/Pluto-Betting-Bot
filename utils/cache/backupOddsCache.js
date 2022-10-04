import { Log } from '#LogColor'
import fs from 'fs-extra'

/**
 * @module backupOddsCache
 * Backup weeklyOdds cache file
 */

export async function backupOddsCache() {
    try {
        await fs.copy(
            './cache/weeklyOdds/oddsCache.json',
            './cache/backups/oddsCacheBackup.json',
            { overwrite: true },
        )
        Log.Green(`Successfully backed up oddsCache.json`)
        return true
    } catch (err) {
        Log.Red(`Error backing up weekly odds cache`, err)
        return false
    }
}
