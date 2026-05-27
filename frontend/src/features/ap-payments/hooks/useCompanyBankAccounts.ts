import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

export interface CompanyBankAccount {
  id: number
  bank_name: string
  account_name: string
  account_number: string
  is_primary: boolean
  is_active: boolean
  balance?: number
}

interface UseCompanyBankAccountsOptions {
  includeBalance?: boolean
  companyId?: string
}

/**
 * Fetches company bank accounts with optional balance information.
 *
 * The `includeBalance` option should be set based on the user's
 * ('bank_accounts', 'release') permission — that check is done
 * at the component level, not inside this hook.
 */
export function useCompanyBankAccounts(options?: UseCompanyBankAccountsOptions) {
  const includeBalance = options?.includeBalance ?? false
  const companyId = options?.companyId

  return useQuery({
    queryKey: ['bank-accounts', 'company', companyId ?? 'all', { includeBalance }],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        owner_type: 'company',
        is_active: true,
        limit: 200,
      }
      if (companyId) params.owner_id = companyId
      if (includeBalance) params.include_balance = true
      const { data } = await api.get('/bank-accounts', { params })
      return (data.data ?? []) as CompanyBankAccount[]
    },
    staleTime: 5 * 60_000,
  })
}
