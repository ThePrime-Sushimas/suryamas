import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCreateSettlement } from '../api/pettyCash.api'
import type { PettyCashRequest } from '../types/pettyCash.types'

export type SettlementFormState = {
  settlement_date: string
  amount_returned: number | ''
  return_bank_account_id: string
  refill_amount: number | ''
  refill_bank_account_id: string
  notes: string
}

export function useSettlementForm(requestId: string, request: PettyCashRequest | undefined) {
  const navigate = useNavigate()
  const toast = useToast()
  const createSettlement = useCreateSettlement()

  const [form, setForm] = useState<SettlementFormState>({
    settlement_date: new Date().toISOString().slice(0, 10),
    amount_returned: 0,
    return_bank_account_id: '',
    refill_amount: 0,
    refill_bank_account_id: '',
    notes: '',
  })

  const remaining = useMemo(() => {
    if (!request) return 0
    return request.total_disbursed - request.total_expenses
  }, [request])

  const amountReturned = form.amount_returned === '' ? 0 : form.amount_returned
  const refillAmount = form.refill_amount === '' ? 0 : form.refill_amount
  const carriedToAmount = Math.max(0, remaining - amountReturned)
  const totalDanaBaru = carriedToAmount + refillAmount

  const handleSubmit = async () => {
    if (!requestId) return
    if (amountReturned > remaining + 1000) {
      toast.error(
        `Jumlah dikembalikan (${amountReturned}) melebihi saldo tersisa (${remaining})`,
      )
      return
    }
    if (amountReturned > 0 && !form.return_bank_account_id) {
      toast.error('Pilih rekening pengembalian')
      return
    }
    if (refillAmount > 0 && !form.refill_bank_account_id) {
      toast.error('Pilih rekening refill')
      return
    }
    try {
      await createSettlement.mutateAsync({
        requestId,
        settlement_date: form.settlement_date || undefined,
        amount_returned: amountReturned,
        return_bank_account_id:
          amountReturned > 0 ? Number(form.return_bank_account_id) : undefined,
        refill_amount: refillAmount > 0 ? refillAmount : undefined,
        refill_bank_account_id:
          refillAmount > 0 ? Number(form.refill_bank_account_id) : undefined,
        notes: form.notes || undefined,
      })
      toast.success('Settlement berhasil diposting')
      navigate(`/finance/petty-cash/${requestId}`)
    } catch (err) {
      toast.error(parseApiError(err, 'Gagal membuat settlement'))
    }
  }

  return {
    form,
    setForm,
    remaining,
    amountReturned,
    refillAmount,
    carriedToAmount,
    totalDanaBaru,
    handleSubmit,
    isPending: createSettlement.isPending,
  }
}
