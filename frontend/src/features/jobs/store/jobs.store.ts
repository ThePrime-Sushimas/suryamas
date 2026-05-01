/**
 * Jobs Store
 */

import { create } from 'zustand'
import { jobsApi } from '../api/jobs.api'
import { parseApiError } from '@/lib/errorParser'
import type { Job } from '../types/jobs.types'

const STALE_TIME = 5_000 // 5s dedup window

interface JobsState {
  jobs: Job[]
  loading: boolean
  error: string | null
  _lastFetchedAt: number
  
  fetchRecentJobs: () => Promise<void>
  downloadFile: (job: Job) => void
  clearError: () => void
  clearAllJobs: () => Promise<void>
}

export const useJobsStore = create<JobsState>((set, get) => ({
  jobs: [],
  loading: false,
  error: null,
  _lastFetchedAt: 0,

  fetchRecentJobs: async () => {
    const now = Date.now()
    if (now - get()._lastFetchedAt < STALE_TIME) return // dedup
    set({ loading: true, error: null, _lastFetchedAt: now })
    try {
      const jobs = await jobsApi.getRecentJobs()
      set({ jobs, loading: false })
    } catch (error: unknown) {
      set({ 
        error: parseApiError(error, 'Gagal memuat daftar tugas'),
        loading: false,
        _lastFetchedAt: 0,
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
    } catch (error: unknown) {
      set({ 
        error: parseApiError(error, 'Gagal menghapus tugas'),
        loading: false 
      })
    }
  },
}))
