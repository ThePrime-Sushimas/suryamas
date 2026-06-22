import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import type { PaymentMethodAlertGroup, CreateAlertGroupDto, UpdateAlertGroupDto } from '../types'

export const alertGroupKeys = {
  all: ['payment-method-alert-groups'] as const,
  list: () => [...alertGroupKeys.all, 'list'] as const,
}

export const useAlertGroups = () =>
  useQuery({
    queryKey: alertGroupKeys.list(),
    queryFn: async () => {
      const { data } = await api.get('/payment-method-alert-groups')
      return data.data as PaymentMethodAlertGroup[]
    },
  })

export const useCreateAlertGroup = () => {
  const qc = useQueryClient()
  const { success, error } = useToast()

  return useMutation({
    mutationFn: async (dto: CreateAlertGroupDto) => {
      const { data } = await api.post('/payment-method-alert-groups', dto)
      return data.data as PaymentMethodAlertGroup
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: alertGroupKeys.list() })
      success('Alert group berhasil dibuat')
    },
    onError: (err) => error(parseApiError(err, 'Gagal membuat alert group')),
  })
}

export const useUpdateAlertGroup = () => {
  const qc = useQueryClient()
  const { success, error } = useToast()

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdateAlertGroupDto }) => {
      const { data } = await api.put(`/payment-method-alert-groups/${id}`, dto)
      return data.data as PaymentMethodAlertGroup
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: alertGroupKeys.list() })
      success('Alert group berhasil diperbarui')
    },
    onError: (err) => error(parseApiError(err, 'Gagal memperbarui alert group')),
  })
}

export const useDeleteAlertGroup = () => {
  const qc = useQueryClient()
  const { success, error } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/payment-method-alert-groups/${id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: alertGroupKeys.list() })
      success('Alert group berhasil dihapus')
    },
    onError: (err) => error(parseApiError(err, 'Gagal menghapus alert group')),
  })
}

export const useTestAlertGroup = () => {
  const { success, error } = useToast()

  return useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/payment-method-alert-groups/test/${id}`)
    },
    onSuccess: () => success('Test alert group terkirim ke Telegram'),
    onError: (err) => error(parseApiError(err, 'Gagal mengirim test alert group')),
  })
}
