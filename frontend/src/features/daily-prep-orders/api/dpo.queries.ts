import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listDpos,
  getDpoById,
  generateDpo,
  updateDpoLines,
  deleteDpoLine,
  acquireLock,
  confirmDpo,
  cancelDpo,
  softDeleteDpo,
  getForecastConfig,
  upsertForecastConfig,
  getHolidays,
  upsertHoliday,
  deleteHoliday,
} from './dpo.api'
import type {
  DpoListParams,
  GenerateDpoBody,
  UpdateLinesBody,
  UpsertConfigBody,
} from '../types/dpo.types'

// ── Query Keys ────────────────────────────────────────────────────────────────

export const dpoKeys = {
  all: ['dpo'] as const,
  lists: () => [...dpoKeys.all, 'list'] as const,
  list: (params: DpoListParams) => [...dpoKeys.lists(), params] as const,
  details: () => [...dpoKeys.all, 'detail'] as const,
  detail: (id: string) => [...dpoKeys.details(), id] as const,
  config: (branchId: string) => [...dpoKeys.all, 'config', branchId] as const,
  holidays: (year: number) => [...dpoKeys.all, 'holidays', year] as const,
}

// ── Queries ───────────────────────────────────────────────────────────────────

export function useDpoList(params: DpoListParams = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: dpoKeys.list(params),
    queryFn: () => listDpos(params),
    enabled: options?.enabled ?? true,
  })
}

export function useDpoDetail(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: dpoKeys.detail(id),
    queryFn: () => getDpoById(id),
    enabled: (options?.enabled ?? true) && Boolean(id),
  })
}

export function useForecastConfig(branchId: string) {
  return useQuery({
    queryKey: dpoKeys.config(branchId),
    queryFn: () => getForecastConfig(branchId),
    enabled: Boolean(branchId),
  })
}

export function useHolidays(params: { from: string; to: string }) {
  return useQuery({
    queryKey: dpoKeys.holidays(new Date(params.from).getFullYear()),
    queryFn: () => getHolidays(params),
    enabled: Boolean(params.from && params.to),
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useGenerateDpo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: GenerateDpoBody) => generateDpo(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dpoKeys.lists() })
    },
  })
}

export function useUpdateDpoLines(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateLinesBody) => updateDpoLines(id, body),
    onSuccess: (data) => {
      qc.setQueryData(dpoKeys.detail(id), data)
      qc.invalidateQueries({ queryKey: dpoKeys.detail(id) })
    },
  })
}

export function useDeleteDpoLine(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (lineId: string) => deleteDpoLine(id, lineId),
    onSuccess: (data) => {
      qc.setQueryData(dpoKeys.detail(id), data)
      qc.invalidateQueries({ queryKey: dpoKeys.detail(id) })
    },
  })
}

export function useAcquireLock(id: string) {
  return useMutation({
    mutationFn: () => acquireLock(id),
  })
}

export function useConfirmDpo(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { lock_token: string }) => confirmDpo(id, body),
    onSuccess: (data) => {
      qc.setQueryData(dpoKeys.detail(id), data)
      qc.invalidateQueries({ queryKey: dpoKeys.lists() })
      qc.invalidateQueries({ queryKey: dpoKeys.detail(id) })
    },
  })
}

export function useCancelDpo(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { reason: string }) => cancelDpo(id, body),
    onSuccess: (data) => {
      qc.setQueryData(dpoKeys.detail(id), data)
      qc.invalidateQueries({ queryKey: dpoKeys.lists() })
      qc.invalidateQueries({ queryKey: dpoKeys.detail(id) })
    },
  })
}

export function useSoftDeleteDpo(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => softDeleteDpo(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dpoKeys.lists() })
      qc.invalidateQueries({ queryKey: dpoKeys.detail(id) })
    },
  })
}

export function useUpsertForecastConfig(branchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpsertConfigBody) => upsertForecastConfig(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dpoKeys.config(branchId) })
    },
  })
}

export function useUpsertHoliday(year: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { holiday_date: string; holiday_name: string }) =>
      upsertHoliday(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dpoKeys.holidays(year) })
    },
  })
}

export function useDeleteHoliday(year: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (holidayId: string) => deleteHoliday(holidayId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dpoKeys.holidays(year) })
    },
  })
}
