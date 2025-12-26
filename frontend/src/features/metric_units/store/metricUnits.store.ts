import { create } from 'zustand'
import { metricUnitsApi } from '../api/metricUnits.api'
import type { MetricUnit, CreateMetricUnitDto, UpdateMetricUnitDto } from '../types'

interface MetricUnitsState {
  metricUnits: MetricUnit[]
  loading: boolean
  error: string | null
  
  fetchMetricUnits: (page?: number, limit?: number) => Promise<void>
  createMetricUnit: (data: CreateMetricUnitDto) => Promise<MetricUnit>
  updateMetricUnit: (id: string, data: UpdateMetricUnitDto) => Promise<MetricUnit>
  deleteMetricUnit: (id: string) => Promise<void>
  clearError: () => void
}

export const useMetricUnitsStore = create<MetricUnitsState>((set, get) => ({
  metricUnits: [],
  loading: false,
  error: null,

  fetchMetricUnits: async (page = 1, limit = 10) => {
    set({ loading: true, error: null })
    try {
      const res = await metricUnitsApi.list(page, limit)
      set({ metricUnits: res.data, loading: false })
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to fetch metric units', loading: false })
    }
  },

  createMetricUnit: async (data) => {
    set({ loading: true, error: null })
    try {
      const metricUnit = await metricUnitsApi.create(data)
      set({ loading: false })
      return metricUnit
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to create metric unit', loading: false })
      throw error
    }
  },

  updateMetricUnit: async (id, data) => {
    set({ loading: true, error: null })
    try {
      const metricUnit = await metricUnitsApi.update(id, data)
      set(state => ({
        metricUnits: state.metricUnits.map(m => m.id === id ? metricUnit : m),
        loading: false
      }))
      return metricUnit
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to update metric unit', loading: false })
      throw error
    }
  },

  deleteMetricUnit: async (id) => {
    const prev = get().metricUnits
    set(state => ({ metricUnits: state.metricUnits.filter(m => m.id !== id) }))
    try {
      await metricUnitsApi.delete(id)
    } catch (error: any) {
      set({ metricUnits: prev, error: error.response?.data?.error || 'Failed to delete metric unit' })
      throw error
    }
  },

  clearError: () => set({ error: null })
}))
