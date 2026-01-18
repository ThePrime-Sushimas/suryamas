/**
 * Jobs Store
 */

import { create } from 'zustand'
import { jobsApi } from '../api/jobs.api'
import type { Job } from '../types/jobs.types'

interface JobsState {
  jobs: Job[]
  loading: boolean
  error: string | null
  
  fetchRecentJobs: () => Promise<void>
  downloadFile: (job: Job) => void
  clearError: () => void
  clearAllJobs: () => Promise<void>
}

export const useJobsStore = create<JobsState>((set) => ({
  jobs: [],
  loading: false,
  error: null,

  fetchRecentJobs: async () => {
    set({ loading: true, error: null })
    try {
      const jobs = await jobsApi.getRecentJobs()
      set({ jobs, loading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch jobs',
        loading: false 
      })
    }
  },

  downloadFile: (job: Job) => {
    if (job.result_url) {
      window.open(job.result_url, '_blank')
    }
  },

  clearError: () => set({ error: null }),

  clearAllJobs: async () => {
    set({ loading: true, error: null })
    try {
      await jobsApi.clearAllJobs()
      set({ jobs: [], loading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to clear jobs',
        loading: false 
      })
    }
  },
}))
