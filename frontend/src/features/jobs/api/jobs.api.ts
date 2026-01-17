/**
 * Jobs API Client
 */

import axios from '@/lib/axios'
import type { Job } from '../types/jobs.types'

export const jobsApi = {
  getRecentJobs: async (): Promise<Job[]> => {
    const response = await axios.get('/jobs/recent')
    return response.data.data
  },

  getJobById: async (id: string): Promise<Job> => {
    const response = await axios.get(`/jobs/${id}`)
    return response.data.data
  },

  cancelJob: async (id: string): Promise<Job> => {
    const response = await axios.post(`/jobs/${id}/cancel`)
    return response.data.data
  },
}
