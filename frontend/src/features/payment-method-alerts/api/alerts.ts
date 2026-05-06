import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import type { PaymentMethodAlert, CreateAlertDto, UpdateAlertDto, PaymentMethod } from '../types'

export const alertKeys = {
  all: ['payment-method-alerts'] as const,
  list: () => [...alertKeys.all, 'list'] as const,
  detail: (id: string) => [...alertKeys.all, 'detail', id] as const,
}

export const useAlerts = () =>
  useQuery({
    queryKey: alertKeys.list(),
    queryFn: async () => {
      const { data } = await api.get('/payment-method-alerts')
      return data.data as PaymentMethodAlert[]
    },
  })

export const usePaymentMethods = () =>
  useQuery({
    queryKey: ['payment-methods', 'list'],
    queryFn: async () => {
      const { data } = await api.get('/payment-methods', { params: { limit: 100 } })
      return data.data as PaymentMethod[]
    },
  })

export const useCreateAlert = () => {
  const qc = useQueryClient()
  const { success, error } = useToast()

  return useMutation({
    mutationFn: async (dto: CreateAlertDto) => {
      const { data } = await api.post('/payment-method-alerts', dto)
      return data.data as PaymentMethodAlert
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: alertKeys.list() })
      success('Alert berhasil dibuat')
    },
    onError: (err) => error(parseApiError(err, 'Gagal membuat alert')),
  })
}

export const useUpdateAlert = () => {
  const qc = useQueryClient()
  const { success, error } = useToast()

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateAlertDto }) => {
      const { data } = await api.put(`/payment-method-alerts/${id}`, dto)
      return data.data as PaymentMethodAlert
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: alertKeys.list() })
      success('Alert berhasil diperbarui')
    },
    onError: (err) => error(parseApiError(err, 'Gagal memperbarui alert')),
  })
}

export const useDeleteAlert = () => {
  const qc = useQueryClient()
  const { success, error } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/payment-method-alerts/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: alertKeys.list() })
      success('Alert berhasil dihapus')
    },
    onError: (err) => error(parseApiError(err, 'Gagal menghapus alert')),
  })
}

export const useTestAlert = () => {
  const { success, error } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/payment-method-alerts/test/${id}`)
    },
    onSuccess: () => success('Test alert terkirim ke Telegram'),
    onError: (err) => error(parseApiError(err, 'Gagal mengirim test alert')),
  })
}