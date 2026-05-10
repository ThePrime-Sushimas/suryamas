import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import type {
  TheoreticalConsumptionResult, VarianceResult, CoverageSummary,
  MenuProfitabilityItem, CostTrendItem, WasteSummaryResult,
} from '../types/food-production.types'

interface ConsumptionParams {
  period_start: string
  period_end: string
  branch_id?: string
}

const KEYS = {
  theoretical: (p: ConsumptionParams) => ['theoretical-consumption', 'theoretical', p] as const,
  variance: (p: ConsumptionParams) => ['theoretical-consumption', 'variance', p] as const,
  coverage: (p: ConsumptionParams) => ['theoretical-consumption', 'coverage', p] as const,
  profitability: (p: ConsumptionParams) => ['theoretical-consumption', 'profitability', p] as const,
  costTrend: (p: ConsumptionParams) => ['theoretical-consumption', 'cost-trend', p] as const,
  waste: (p: ConsumptionParams) => ['theoretical-consumption', 'waste', p] as const,
}

export const useTheoreticalConsumption = (params: ConsumptionParams) =>
  useQuery({
    queryKey: KEYS.theoretical(params),
    queryFn: async () => {
      const { data } = await api.get('/theoretical-consumption', { params })
      return data.data as TheoreticalConsumptionResult
    },
    enabled: !!params.period_start && !!params.period_end,
    staleTime: 60_000,
  })

export const useVariance = (params: ConsumptionParams) =>
  useQuery({
    queryKey: KEYS.variance(params),
    queryFn: async () => {
      const { data } = await api.get('/theoretical-consumption/variance', { params })
      return data.data as VarianceResult
    },
    enabled: !!params.period_start && !!params.period_end,
    staleTime: 60_000,
  })

export const useCoverage = (params: ConsumptionParams) =>
  useQuery({
    queryKey: KEYS.coverage(params),
    queryFn: async () => {
      const { data } = await api.get('/theoretical-consumption/coverage', { params })
      return data.data as CoverageSummary
    },
    enabled: !!params.period_start && !!params.period_end,
    staleTime: 60_000,
  })

export const useMenuProfitability = (params: ConsumptionParams) =>
  useQuery({
    queryKey: KEYS.profitability(params),
    queryFn: async () => {
      const { data } = await api.get('/theoretical-consumption/menu-profitability', { params })
      return data.data as MenuProfitabilityItem[]
    },
    enabled: !!params.period_start && !!params.period_end,
    staleTime: 60_000,
  })

export const useCostTrend = (params: ConsumptionParams) =>
  useQuery({
    queryKey: KEYS.costTrend(params),
    queryFn: async () => {
      const { data } = await api.get('/theoretical-consumption/cost-trend', { params })
      return data.data as CostTrendItem[]
    },
    enabled: !!params.period_start && !!params.period_end,
    staleTime: 60_000,
  })

export const useWasteSummary = (params: ConsumptionParams) =>
  useQuery({
    queryKey: KEYS.waste(params),
    queryFn: async () => {
      const { data } = await api.get('/theoretical-consumption/waste-summary', { params })
      return data.data as WasteSummaryResult
    },
    enabled: !!params.period_start && !!params.period_end,
    staleTime: 60_000,
  })
