import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

export type WasteSource =
  | 'GOODS_PROCESSING'
  | 'STOCK_ADJUSTMENT'
  | 'PRODUCTION_ORDER'
  | 'DAILY_OPNAME'

export interface WasteRecord {
  source: WasteSource
  date: string
  branch_id: string
  branch_name?: string
  item_id: string
  item_name?: string
  qty: number
  unit_cost: number
  total_cost: number
  reason?: string
  reference_id: string
  reference_code?: string
  metadata?: Record<string, unknown>
}

export interface MonthlyOpnameSelisih {
  date: string
  branch_id: string
  branch_name?: string
  item_id: string
  item_name?: string
  selisih_qty: number
  selisih_value: number
  investigasi_note?: string
  reference_id: string
}

export interface WasteReportSummary {
  total_waste_qty: number
  total_waste_cost: number
  breakdown_by_source: Record<WasteSource, { qty: number; cost: number }>
  percentage_of_purchase?: number
}

export interface WasteReportResponse {
  summary: WasteReportSummary
  records: WasteRecord[]
  monthly_selisih: MonthlyOpnameSelisih[]
}

export interface WasteByItemGroup {
  item_id: string
  item_name?: string
  total_qty: number
  total_cost: number
  record_count: number
  breakdown_by_source: Record<WasteSource, { qty: number; cost: number }>
}

export interface WasteReportParams {
  start_date: string
  end_date: string
  branch_id?: string
  item_id?: string
  category_id?: string
  source?: WasteSource
}

export const wasteReportKeys = {
  report: (p: WasteReportParams) => ['waste-report', p] as const,
  byItem: (p: WasteReportParams) => ['waste-report', 'by-item', p] as const,
}

export const useWasteReport = (params: WasteReportParams | null) =>
  useQuery({
    queryKey: wasteReportKeys.report(params ?? { start_date: '', end_date: '' }),
    queryFn: async () => {
      const { data } = await api.get('/waste-report', { params })
      return data.data as WasteReportResponse
    },
    enabled: !!params?.start_date && !!params?.end_date,
  })

export const useWasteReportByItem = (params: WasteReportParams | null) =>
  useQuery({
    queryKey: wasteReportKeys.byItem(params ?? { start_date: '', end_date: '' }),
    queryFn: async () => {
      const { data } = await api.get('/waste-report/by-item', { params })
      return data.data as WasteByItemGroup[]
    },
    enabled: !!params?.start_date && !!params?.end_date,
  })
