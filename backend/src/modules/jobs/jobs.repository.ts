/**
 * Jobs Repository
 * Database access layer for background job queue
 */

import { supabase } from '@/config/supabase'
import { logInfo, logError } from '@/config/logger'
import { Job, CreateJobDto, UpdateJobDto, JobFilters } from './jobs.types'
import { JobErrors } from './jobs.errors'
import { JOB_QUEUE_CONFIG } from './jobs.constants'

export class JobsRepository {
  /**
   * Find user's recent jobs (last 10, excluding deleted)
   */
  async findUserRecentJobs(userId: string): Promise<Job[]> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .in('status', ['pending', 'processing', 'completed'])
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error

      logInfo('Repository findUserRecentJobs success', { user_id: userId, count: data?.length || 0 })
      return data || []
    } catch (error) {
      logError('Repository findUserRecentJobs error', { user_id: userId, error })
      throw error
    }
  }

  /**
   * Find job by ID
   */
  async findById(id: string, userId: string): Promise<Job | null> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null
        throw error
      }

      logInfo('Repository findById success', { id, user_id: userId })
      return data
    } catch (error) {
      logError('Repository findById error', { id, user_id: userId, error })
      throw error
    }
  }

  /**
   * Check if user has active job (excluding deleted)
   */
  async hasActiveJob(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .in('status', ['pending', 'processing'])
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      return !!data
    } catch (error) {
      logError('Repository hasActiveJob error', { user_id: userId, error })
      throw error
    }
  }

  /**
   * Create new job atomically (prevents race condition)
   */
  async create(dto: CreateJobDto): Promise<Job> {
    try {
      const { data, error } = await supabase
        .rpc('create_job_atomic', {
          p_user_id: dto.user_id,
          p_company_id: dto.company_id,
          p_type: dto.type,
          p_module: dto.module,
          p_name: dto.name,
          p_metadata: dto.metadata || {}
        })

      if (error) {
        if (error.code === '23505') {
          throw JobErrors.ALREADY_PROCESSING()
        }
        throw error
      }

      logInfo('Repository create success', { id: data.id, name: dto.name, type: dto.type, module: dto.module })
      return data
    } catch (error) {
      if (error instanceof Error && error.message.includes('already has an active job')) {
        throw JobErrors.ALREADY_PROCESSING()
      }
      logError('Repository create error', { dto, error })
      throw error
    }
  }

  /**
   * Update job
   */
  async update(id: string, userId: string, updates: UpdateJobDto): Promise<Job> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) {
        if (error.code === 'PGRST116') throw JobErrors.NOT_FOUND()
        throw error
      }

      logInfo('Repository update success', { id, updates })
      return data
    } catch (error) {
      logError('Repository update error', { id, user_id: userId, updates, error })
      throw error
    }
  }

  /**
   * Mark job as processing atomically
   */
  async markAsProcessing(id: string): Promise<Job> {
    try {
      const { data, error } = await supabase
        .rpc('mark_job_processing_atomic', {
          p_job_id: id
        })

      if (error) throw error

      logInfo('Repository markAsProcessing success', { id })
      return data
    } catch (error) {
      logError('Repository markAsProcessing error', { id, error })
      throw error
    }
  }

  /**
   * Mark job as completed atomically
   */
  async markAsCompleted(
    id: string,
    userId: string,
    resultUrl: string,
    filePath: string,
    fileSize: number
  ): Promise<Job> {
    try {
      const expiresAt = new Date(Date.now() + JOB_QUEUE_CONFIG.resultExpiration)

      const { data, error } = await supabase
        .rpc('complete_job_atomic', {
          p_job_id: id,
          p_result_url: resultUrl,
          p_file_path: filePath,
          p_file_size: fileSize,
          p_expires_at: expiresAt.toISOString(),
          p_updated_by: userId
        })

      if (error) throw error

      logInfo('Repository markAsCompleted success', { id, expires_at: expiresAt })
      return data
    } catch (error) {
      logError('Repository markAsCompleted error', { id, error })
      throw error
    }
  }

  /**
   * Mark job as failed atomically
   */
  async markAsFailed(id: string, userId: string, errorMessage: string): Promise<Job> {
    try {
      const { data, error } = await supabase
        .rpc('fail_job_atomic', {
          p_job_id: id,
          p_error_message: errorMessage,
          p_updated_by: userId
        })

      if (error) throw error

      logInfo('Repository markAsFailed success', { id })
      return data
    } catch (error) {
      logError('Repository markAsFailed error', { id, error })
      throw error
    }
  }

  /**
   * Update job progress
   */
  async updateProgress(id: string, progress: number, userId?: string): Promise<void> {
    try {
      let query = supabase
        .from('jobs')
        .update({ progress })
        .eq('id', id)

      // Add user_id filter if provided (for security)
      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { error } = await query

      if (error) throw error

      logInfo('Repository updateProgress success', { id, progress })
    } catch (error) {
      logError('Repository updateProgress error', { id, progress, error })
      throw error
    }
  }

  /**
   * Find expired jobs (excluding deleted)
   */
  async findExpiredJobs(limit: number = 100): Promise<Job[]> {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'completed')
        .is('deleted_at', null)
        .not('expires_at', 'is', null)
        .lt('expires_at', new Date().toISOString())
        .limit(limit)

      if (error) throw error

      logInfo('Repository findExpiredJobs success', { count: data?.length || 0 })
      return data || []
    } catch (error) {
      logError('Repository findExpiredJobs error', { error })
      throw error
    }
  }

  /**
   * Soft delete job
   */
  async delete(id: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .rpc('soft_delete_job', {
          p_job_id: id,
          p_user_id: userId,
          p_deleted_by: userId
        })

      if (error) throw error

      logInfo('Repository soft delete success', { id, deleted_by: userId })
    } catch (error) {
      logError('Repository delete error', { id, user_id: userId, error })
      throw error
    }
  }
}

export const jobsRepository = new JobsRepository()
