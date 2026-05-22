import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'

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
}

/**
 * Fetches company bank accounts with optional balance information.
 *
 * The `includeBalance` option should be set based on the user's
 * ('bank_accounts', 'release') permission — that check is done
 * at the component level, not inside this hook.
 */
export function useCompanyBankAccounts(options?: UseCompanyBankAccountsOptions) {
  const companyId = useBranchContextStore((s) => s.currentBranch?.company_id)
  const includeBalance = options?.includeBalance ?? false

  return useQuery({
    queryKey: ['bank-accounts', 'company', companyId, { includeBalance }],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        owner_type: 'company',
        owner_id: companyId,
        is_active: true,
      }
      if (includeBalance) {
        params.include_balance = true
      }
      const { data } = await api.get('/bank-accounts', { params })
      return (data.data ?? []) as CompanyBankAccount[]
    },
    enabled: !!companyId,
    staleTime: 5 * 60_000,
  })
}
