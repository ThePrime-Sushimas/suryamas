import api from '@/lib/axios'
import type { BankAccount, CreateBankAccountDto, UpdateBankAccountDto, ApiResponse } from '../types'

export const bankAccountsApi = {
  getByOwner: async (ownerType: 'company' | 'supplier', ownerId: string) => {
    const res = await api.get<ApiResponse<BankAccount[]>>('/bank-accounts', {
      params: { owner_type: ownerType, owner_id: ownerId }
    })
    return res.data.data
  },

  getById: async (id: number) => {
    const res = await api.get<ApiResponse<BankAccount>>(`/bank-accounts/${id}`)
    return res.data.data
  },

  create: async (data: CreateBankAccountDto) => {
    const res = await api.post<ApiResponse<BankAccount>>('/bank-accounts', data)
    return res.data.data
  },

  update: async (id: number, data: UpdateBankAccountDto) => {
    const res = await api.put<ApiResponse<BankAccount>>(`/bank-accounts/${id}`, data)
    return res.data.data
  },

  delete: async (id: number) => {
    const res = await api.delete<ApiResponse<void>>(`/bank-accounts/${id}`)
    return res.data
  },
}
