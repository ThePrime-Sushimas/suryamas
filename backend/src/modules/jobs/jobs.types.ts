/**
 * Jobs Module Types
 * Background job queue for export/import operations
 */

export type JobType = 'export' | 'import'
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface Job {
  id: string
  user_id: string
  company_id: string
  type: JobType
  name: string
  status: JobStatus
  progress: number
  result_url?: string
  file_path?: string
  file_size?: number
  error_message?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string
  expires_at?: string
  created_by?: string
  updated_by?: string
  deleted_at?: string
  deleted_by?: string
}

export interface CreateJobDto {
  user_id: string
  company_id: string
  type: JobType
  name: string
  metadata?: Record<string, any>
}

export interface UpdateJobDto {
  status?: JobStatus
  progress?: number
  result_url?: string
  file_path?: string
  file_size?: number
  error_message?: string
  started_at?: string
  completed_at?: string
  expires_at?: string
}

export interface JobFilters {
  type?: JobType
  status?: JobStatus
  search?: string
}

export interface JobQueueConfig {
  maxConcurrentJobs: number
  jobTimeout: number // milliseconds
  retryAttempts: number
  retryDelay: number // milliseconds
  resultExpiration: number // milliseconds (1 hour = 3600000)
  cleanupInterval: number // milliseconds
}
