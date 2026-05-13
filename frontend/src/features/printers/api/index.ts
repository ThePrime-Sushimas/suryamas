import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { Printer, CreatePrinterDto, UpdatePrinterDto } from '../types'

export const usePrinters = () =>
  useQuery({
    queryKey: ['printers'],
    queryFn: async () => {
      const { data } = await api.get<{ data: Printer[] }>('/printers')
      return data.data
    },
  })

export const useCreatePrinter = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CreatePrinterDto) => {
      const { data } = await api.post<{ data: Printer }>('/printers', body)
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['printers'] }),
  })
}

export const useUpdatePrinter = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: UpdatePrinterDto & { id: string }) => {
      const { data } = await api.put<{ data: Printer }>(`/printers/${id}`, body)
      return data.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['printers'] }),
  })
}

export const useDeletePrinter = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/printers/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['printers'] }),
  })
}

export const useTestPrinter = () =>
  useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<{ data: { connected: boolean } }>(`/printers/${id}/test`)
      return data.data.connected
    },
  })

export const usePrintPurchaseRequest = () =>
  useMutation({
    mutationFn: async (payload: { prId: string; printer_id: string; line_ids: string[] }) => {
      await api.post(`/printers/print/purchase-request/${payload.prId}`, {
        printer_id: payload.printer_id,
        line_ids: payload.line_ids,
      })
    },
  })
