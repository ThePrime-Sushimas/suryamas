import api from '@/lib/axios'
import type {
  DailyPrepOrderWithRelations,
  DailyPrepOrderDetail,
  DpoForecastConfig,
  PublicHoliday,
  PaginatedResponse,
  DpoListParams,
  GenerateDpoBody,
  UpdateLinesBody,
  UpsertConfigBody,
} from '../types/dpo.types'

const BASE = '/daily-prep-orders'

// ── List DPOs ─────────────────────────────────────────────────────────────────

export async function listDpos(
  params: DpoListParams
): Promise<PaginatedResponse<DailyPrepOrderWithRelations>> {
  const { data } = await api.get(BASE, { params })
  return { data: data.data, pagination: data.pagination }
}

// ── Get DPO by ID ─────────────────────────────────────────────────────────────

export async function getDpoById(id: string): Promise<DailyPrepOrderDetail> {
  const { data } = await api.get(`${BASE}/${id}`)
  return data.data
}

// ── Generate DPO ──────────────────────────────────────────────────────────────

export async function generateDpo(body: GenerateDpoBody): Promise<DailyPrepOrderDetail> {
  const { data } = await api.post(`${BASE}/generate`, body)
  return data.data
}

// ── Update DPO Lines ──────────────────────────────────────────────────────────

export async function updateDpoLines(
  id: string,
  body: UpdateLinesBody
): Promise<DailyPrepOrderDetail> {
  const { data } = await api.put(`${BASE}/${id}/lines`, body)
  return data.data
}

// ── Delete DPO Line ───────────────────────────────────────────────────────────

export async function deleteDpoLine(
  id: string,
  lineId: string
): Promise<DailyPrepOrderDetail> {
  const { data } = await api.delete(`${BASE}/${id}/lines/${lineId}`)
  return data.data
}

// ── Acquire Lock ──────────────────────────────────────────────────────────────

export async function acquireLock(id: string): Promise<{ lock_token: string }> {
  const { data } = await api.post(`${BASE}/${id}/acquire-lock`)
  return data.data
}

// ── Confirm DPO ───────────────────────────────────────────────────────────────

export async function confirmDpo(
  id: string,
  body: { lock_token: string }
): Promise<DailyPrepOrderDetail> {
  const { data } = await api.post(`${BASE}/${id}/confirm`, body)
  return data.data
}

// ── Cancel DPO ────────────────────────────────────────────────────────────────

export async function cancelDpo(
  id: string,
  body: { reason: string }
): Promise<DailyPrepOrderDetail> {
  const { data } = await api.post(`${BASE}/${id}/cancel`, body)
  return data.data
}

// ── Soft Delete DPO ───────────────────────────────────────────────────────────

export async function softDeleteDpo(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`)
}

// ── Get Forecast Config ───────────────────────────────────────────────────────

export async function getForecastConfig(
  branchId: string
): Promise<DpoForecastConfig | null> {
  const { data } = await api.get(`${BASE}/config/${branchId}`)
  return data.data ?? null
}

// ── Upsert Forecast Config ────────────────────────────────────────────────────

export async function upsertForecastConfig(
  body: UpsertConfigBody
): Promise<DpoForecastConfig> {
  const { data } = await api.put(`${BASE}/config`, body)
  return data.data
}

// ── Get Holidays ──────────────────────────────────────────────────────────────

export async function getHolidays(
  params: { from: string; to: string }
): Promise<PublicHoliday[]> {
  const { data } = await api.get(`${BASE}/holidays`, { params })
  return data.data
}

// ── Upsert Holiday ────────────────────────────────────────────────────────────

export async function upsertHoliday(
  body: { holiday_date: string; holiday_name: string }
): Promise<PublicHoliday> {
  const { data } = await api.put(`${BASE}/holidays`, body)
  return data.data
}

// ── Delete Holiday ────────────────────────────────────────────────────────────

export async function deleteHoliday(holidayId: string): Promise<void> {
  await api.delete(`${BASE}/holidays/${holidayId}`)
}

// ── Print DPO (Thermal) ───────────────────────────────────────────────────────

export async function printDpo(
  dpoId: string,
  body: { printer_id: string; line_ids: string[] }
): Promise<void> {
  await api.post(`/printers/print/daily-prep-order/${dpoId}`, body)
}
