/**
 * Jobs Types - Frontend
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
}
