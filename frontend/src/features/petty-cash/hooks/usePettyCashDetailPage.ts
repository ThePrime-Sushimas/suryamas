import { usePermissionStore } from '@/features/branch_context/store/permission.store'
import { usePettyCashRequest } from './pettyCash.api'
import type { PettyCashExpense } from '../types/pettyCash.types'

export function usePettyCashDetailPage(requestId: string) {
  const hasPermission = usePermissionStore((s) => s.hasPermission)
  const canApprove = hasPermission('petty_cash', 'approve')
  const canInsert = hasPermission('petty_cash', 'insert')
  const canRelease = hasPermission('petty_cash', 'release')

  const { data: request, isLoading } = usePettyCashRequest(requestId)

  const remaining = request ? request.total_disbursed - request.total_expenses : 0
  const expenses: PettyCashExpense[] = request?.expenses ?? []

  return {
    request,
    isLoading,
    remaining,
    expenses,
    canApprove,
    canInsert,
    canRelease,
  }
}
