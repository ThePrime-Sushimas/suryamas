/**
 * useJobPolling Hook
 * Polls job status from backend and provides real-time progress updates
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import api from '@/lib/axios'

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'

export interface JobProgress {
  processed_rows: number
  total_rows: number
  percentage: number
}

export interface JobData {
  id: string
  status: JobStatus
  progress: number | JobProgress
  error_message?: string
  result_url?: string
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
  started_at?: string
  completed_at?: string
}

interface UseJobPollingOptions {
  interval?: number // Polling interval in ms (default: 2000)
  onComplete?: (job: JobData) => void
  onError?: (error: string) => void
}

interface UseJobPollingReturn {
  job: JobData | null
  isLoading: boolean
  error: string | null
  startPolling: (jobId: string) => void
  stopPolling: () => void
  isPolling: boolean
}

export function useJobPolling(options: UseJobPollingOptions = {}): UseJobPollingReturn {
  const {
    interval = 2000,
    onComplete,
    onError,
  } = options

  const [job, setJob] = useState<JobData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentJobIdRef = useRef<string | null>(null)

  // Fetch job status
  const fetchJobStatus = useCallback(async (jobId: string) => {
    const response = await api.get(`/jobs/${jobId}`)
    return response.data.data as JobData
  }, [])

  // Poll job status
  const pollJob = useCallback(async (jobId: string) => {
    try {
      const jobData = await fetchJobStatus(jobId)
      setJob(jobData)

      // Check if job is complete or failed
      const isTerminalStatus = ['completed', 'failed', 'cancelled'].includes(jobData.status)
      
      if (isTerminalStatus) {
        // Stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
        setIsPolling(false)

        // Call callbacks
        if (jobData.status === 'completed' && onComplete) {
          onComplete(jobData)
        } else if ((jobData.status === 'failed' || jobData.status === 'cancelled') && onError) {
          onError(jobData.error_message || `Job ${jobData.status}`)
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      
      if (onError) {
        onError(errorMessage)
      }
      
      // Stop polling on error
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      setIsPolling(false)
    }
  }, [fetchJobStatus, onComplete, onError])

  // Start polling
  const startPolling = useCallback((jobId: string) => {
    // Clear any existing polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
    }

    currentJobIdRef.current = jobId
    setIsLoading(true)
    setError(null)
    setIsPolling(true)

    // Immediate first fetch
    pollJob(jobId)

    // Set up interval
    pollingRef.current = setInterval(() => {
      pollJob(jobId)
    }, interval)

    setIsLoading(false)
  }, [interval, pollJob])

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    setIsPolling(false)
    currentJobIdRef.current = null
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  return {
    job,
    isLoading,
    error,
    startPolling,
    stopPolling,
    isPolling,
  }
}

// Helper function to normalize progress
function normalizeProgress(progress: number | JobProgress): number {
  if (typeof progress === 'number') {
    return progress
  }
  if (progress && typeof progress === 'object' && 'percentage' in progress) {
    return progress.percentage
  }
  return 0
}

// Hook specifically for bank statement import jobs
export function useBankStatementImportJob(importId: number, options: UseJobPollingOptions = {}) {
  const [jobId, setJobId] = useState<string | null>(null)
  
  const jobPolling = useJobPolling({
    ...options,
    onComplete: (job) => {
      // Refresh import data when job completes
      if (options.onComplete) {
        options.onComplete(job)
      }
    },
  })

  // Start import and get job ID
  const startImport = useCallback(async (skipDuplicates: boolean = false) => {
    try {
      // Use axios to confirm import
      const response = await api.post(`/bank-statement-imports/${importId}/confirm`, {
        skip_duplicates: skipDuplicates,
      })
      
      const jobId = response.data.data?.job_id
      
      if (jobId) {
        setJobId(jobId)
        jobPolling.startPolling(jobId)
        return jobId
      }
      
      throw new Error('No job_id returned from confirm import')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start import'
      throw new Error(errorMessage)
    }
  }, [importId, jobPolling])

  return {
    ...jobPolling,
    jobId,
    startImport,
    progress: jobPolling.job ? normalizeProgress(jobPolling.job.progress) : 0,
  }
}
