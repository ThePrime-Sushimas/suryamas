/**
 * Jobs Cleanup
 * Permanently deletes jobs that were already soft-deleted (deleted_at IS NOT NULL)
 * Safe to run via cron / scheduler
 */

import { supabase } from '@/config/supabase'
import { logInfo, logError } from '@/config/logger'

const TABLE = 'jobs'

export async function cleanupDeletedJobs(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .not('deleted_at', 'is', null)
      .select('id')

    if (error) {
      logError('Jobs cleanup failed', { error })
      throw error
    }

    const deletedCount = data?.length ?? 0

    logInfo('Jobs cleanup completed', {
      deleted: deletedCount
    })

    return deletedCount
  } catch (error) {
    logError('Jobs cleanup exception', { error })
    throw error
  }
}
