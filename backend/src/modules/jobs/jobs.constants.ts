/**
 * Jobs Module Constants
 */

import { JobQueueConfig } from './jobs.types'

export const JOB_QUEUE_CONFIG: JobQueueConfig = {
  maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '1'),
  jobTimeout: parseInt(process.env.JOB_TIMEOUT_MS || String(30 * 60 * 1000)),
  retryAttempts: parseInt(process.env.JOB_RETRY_ATTEMPTS || '3'),
  retryDelay: parseInt(process.env.JOB_RETRY_DELAY_MS || '5000'),
  resultExpiration: parseInt(process.env.JOB_RESULT_EXPIRATION_MS || String(12 * 60 * 60 * 1000)), // 12 hours
  cleanupInterval: parseInt(process.env.JOB_CLEANUP_INTERVAL_MS || String(10 * 60 * 1000)),
}

export const STORAGE_BUCKET = 'job-results'

export const JOB_TYPE_LABELS = {
  export: 'Export',
  import: 'Import',
} as const

export const JOB_STATUS_LABELS = {
  pending: 'Waiting for process',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
} as const

export const JOB_STATUS_COLORS = {
  pending: 'text-yellow-600',
  processing: 'text-blue-600',
  completed: 'text-green-600',
  failed: 'text-red-600',
  cancelled: 'text-gray-600',
} as const
