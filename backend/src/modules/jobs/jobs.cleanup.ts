/**
 * Jobs Cleanup
 * Permanently deletes jobs that were already soft-deleted (deleted_at IS NOT NULL)
 * Safe to run via cron / scheduler
 */

import { pool } from '@/config/db'
import { logInfo, logError } from '@/config/logger'

export async function cleanupDeletedJobs(): Promise<number> {
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM jobs WHERE deleted_at IS NOT NULL`
    )
    const deletedCount = rowCount ?? 0
    logInfo('Jobs cleanup completed', { deleted: deletedCount })
    return deletedCount
  } catch (error) {
    logError('Jobs cleanup exception', { error })
    throw error
  }
}
