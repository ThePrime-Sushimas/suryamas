import { useState } from 'react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useDeleteExpense } from '../api/pettyCash.api'
import type { PettyCashExpense } from '../types/pettyCash.types'

export function usePettyCashDetailModals(requestId: string) {
  const toast = useToast()
  const deleteExpenseMutation = useDeleteExpense()

  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [showVoid, setShowVoid] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null)
  const [editingExpense, setEditingExpense] = useState<PettyCashExpense | null>(null)

  const handleDeleteExpense = async () => {
    if (!deleteExpenseId || !requestId) return
    try {
      await deleteExpenseMutation.mutateAsync({ id: deleteExpenseId, requestId })
      setDeleteExpenseId(null)
    } catch (err) { toast.error(parseApiError(err, 'Gagal hapus expense')) }
  }

  return {
    showApprove,
    setShowApprove,
    showReject,
    setShowReject,
    showExpenseForm,
    setShowExpenseForm,
    showVoid,
    setShowVoid,
    showPrint,
    setShowPrint,
    deleteExpenseId,
    setDeleteExpenseId,
    editingExpense,
    setEditingExpense,
    handleDeleteExpense,
    isDeleteExpensePending: deleteExpenseMutation.isPending,
  }
}
