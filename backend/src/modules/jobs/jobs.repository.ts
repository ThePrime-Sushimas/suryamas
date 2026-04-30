import { pool } from '@/config/db'
import { logInfo, logError } from '@/config/logger'
import { Job, CreateJobDto, UpdateJobDto } from './jobs.types'
import { JobErrors } from './jobs.errors'
import { JOB_QUEUE_CONFIG } from './jobs.constants'

export class JobsRepository {
  async findUserRecentJobs(userId: string): Promise<Job[]> {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM jobs WHERE user_id = $1 AND deleted_at IS NULL AND status IN ('pending', 'processing', 'completed') ORDER BY created_at DESC LIMIT 10",
        [userId]
      )
      logInfo('Repository findUserRecentJobs success', { user_id: userId, count: rows.length })
      return rows as Job[]
    } catch (error) {
      logError('Repository findUserRecentJobs error', { user_id: userId, error })
      throw error
    }
  }

  async findPendingJobs(limit?: number): Promise<Job[]> {
    const { rows } = await pool.query(
      "SELECT * FROM jobs WHERE status = 'pending' AND deleted_at IS NULL ORDER BY created_at ASC LIMIT $1",
      [limit || 10]
    )
    return rows as Job[]
  }

  async findById(id: string, userId: string): Promise<Job | null> {
    try {
      const { rows } = await pool.query('SELECT * FROM jobs WHERE id = $1 AND user_id = $2', [id, userId])
      if (!rows[0]) return null
      logInfo('Repository findById success', { id, user_id: userId })
      return rows[0] as Job
    } catch (error) {
      logError('Repository findById error', { id, user_id: userId, error })
      throw error
    }
  }

  async hasActiveJob(userId: string): Promise<boolean> {
    try {
      const { rows } = await pool.query(
        "SELECT id FROM jobs WHERE user_id = $1 AND deleted_at IS NULL AND status IN ('pending', 'processing') LIMIT 1",
        [userId]
      )
      return rows.length > 0
    } catch (error) {
      logError('Repository hasActiveJob error', { user_id: userId, error })
      throw error
    }
  }

  async create(dto: CreateJobDto): Promise<Job> {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM create_job_atomic($1::uuid, $2::uuid, $3::job_type_enum, $4::varchar, $5::varchar, $6::jsonb)',
        [dto.user_id, dto.company_id, dto.type, dto.module, dto.name, JSON.stringify(dto.metadata || {})]
      )

      if (!rows[0]) throw new Error('Job creation failed')
      logInfo('Repository create success', { id: rows[0].id, name: dto.name, type: dto.type, module: dto.module })
      return rows[0] as Job
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string }
      if (err.code === '23505' || err.message?.includes('already has an active job')) {
        throw JobErrors.ALREADY_PROCESSING()
      }
      logError('Repository create error', { dto, error })
      throw error
    }
  }

  async update(id: string, userId: string, updates: UpdateJobDto): Promise<Job> {
    try {
      const keys = Object.keys(updates)
      if (!keys.length) {
        const existing = await this.findById(id, userId)
        if (!existing) throw JobErrors.NOT_FOUND()
        return existing
      }
      const values = Object.values(updates)
      const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
      const { rows } = await pool.query(
        `UPDATE jobs SET ${set} WHERE id = $${keys.length + 1} AND user_id = $${keys.length + 2} RETURNING *`,
        [...values, id, userId]
      )
      if (!rows[0]) throw JobErrors.NOT_FOUND()
      logInfo('Repository update success', { id, updates })
      return rows[0] as Job
    } catch (error) {
      logError('Repository update error', { id, user_id: userId, updates, error })
      throw error
    }
  }

  async markAsProcessing(id: string): Promise<Job> {
    try {
      const { rows } = await pool.query('SELECT * FROM mark_job_processing_atomic($1::uuid)', [id])
      if (!rows[0]) throw JobErrors.NOT_FOUND()
      logInfo('Repository markAsProcessing success', { id })
      return rows[0] as Job
    } catch (error) {
      logError('Repository markAsProcessing error', { id, error })
      throw error
    }
  }

  async markAsCompleted(id: string, userId: string, resultUrl: string, filePath: string, fileSize: number): Promise<Job> {
    try {
      const expiresAt = new Date(Date.now() + JOB_QUEUE_CONFIG.resultExpiration)
      const { rows } = await pool.query(
        'SELECT * FROM complete_job_atomic($1::uuid, $2::text, $3::text, $4::bigint, $5::timestamptz, $6::uuid)',
        [id, resultUrl, filePath, fileSize, expiresAt.toISOString(), userId]
      )
      if (!rows[0]) throw JobErrors.NOT_FOUND()
      logInfo('Repository markAsCompleted success', { id, expires_at: expiresAt })
      return rows[0] as Job
    } catch (error) {
      logError('Repository markAsCompleted error', { id, error })
      throw error
    }
  }

  async markAsFailed(id: string, userId: string, errorMessage: string): Promise<Job> {
    try {
      const { rows } = await pool.query(
        'SELECT * FROM fail_job_atomic($1::uuid, $2::text, $3::uuid)',
        [id, errorMessage, userId]
      )
      if (!rows[0]) throw JobErrors.NOT_FOUND()
      logInfo('Repository markAsFailed success', { id, errorMessage })
      return rows[0] as Job
    } catch (error) {
      logError('Repository markAsFailed error', { id, error })
      throw error
    }
  }

  async updateProgress(id: string, progress: number, userId?: string): Promise<void> {
    try {
      const params: (string | number)[] = [progress, id]
      let query = 'UPDATE jobs SET progress = $1 WHERE id = $2'
      if (userId) { params.push(userId); query += ' AND user_id = $3' }
      await pool.query(query, params)
      logInfo('Repository updateProgress success', { id, progress })
    } catch (error) {
      logError('Repository updateProgress error', { id, progress, error })
      throw error
    }
  }

  async findExpiredJobs(limit = 100): Promise<Job[]> {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM jobs WHERE status = 'completed' AND deleted_at IS NULL AND expires_at IS NOT NULL AND expires_at < NOW() LIMIT $1",
        [limit]
      )
      return rows as Job[]
    } catch (error) {
      logError('Repository findExpiredJobs error', { error })
      throw error
    }
  }

  async delete(id: string, userId: string): Promise<void> {
    try {
      await pool.query('SELECT soft_delete_job($1::uuid, $2::uuid, $3::uuid)', [id, userId, userId])
      logInfo('Repository soft delete success', { id, deleted_by: userId })
    } catch (error) {
      logError('Repository delete error', { id, user_id: userId, error })
      throw error
    }
  }
}

export const jobsRepository = new JobsRepository()
