import { useState, useCallback, useEffect } from 'react'
import { Plus, Coins } from 'lucide-react'
import { useCashCountsStore } from '../store/cashCounts.store'
import { useToast } from '@/contexts/ToastContext'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { CashCountTable } from '../components/CashCountTable'
import { CashCountFilters } from '../components/CashCountFilters'
import { CashCountCreateModal } from '../components/CashCountCreateModal'
import { CashCountDetailPanel } from '../components/CashCountDetailPanel'
import type { CashCount, CreateCashCountDto, UpdatePhysicalCountDto, DepositDto } from '../types'
import api from '@/lib/axios'

export function CashCountsPage() {
  const toast = useToast()
  const {
    items, page, limit, total, totalPages, filter, isLoading, isMutating,
    fetchList, fetchById, create, updatePhysicalCount, deposit, close, remove,
    setFilter, setPage, setLimit, selected,
  } = useCashCountsStore()

  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CashCount | null>(null)

  // Reference data
  const [branches, setBranches] = useState<{ id: string; branch_name: string }[]>([])
  const [paymentMethods, setPaymentMethods] = useState<{ id: number; name: string }[]>([])
  const [employees, setEmployees] = useState<{ id: string; full_name: string }[]>([])
  const [bankAccounts, setBankAccounts] = useState<{ id: number; account_name: string; bank_name: string }[]>([])

  // Fetch reference data on mount
  useEffect(() => {
    api.get('/branches').then((r) => setBranches(r.data.data || [])).catch(() => {})
    api.get('/payment-methods/options').then((r) => setPaymentMethods((r.data.data || []).map((pm: any) => ({ id: pm.id, name: pm.name })))).catch(() => {})
    api.get('/employees', { params: { limit: 500 } }).then((r) => setEmployees(r.data.data || [])).catch(() => {})
    api.get('/bank-accounts').then((r) => setBankAccounts(
      (r.data.data || []).map((a: any) => ({ id: a.id, account_name: a.account_name, bank_name: a.banks?.bank_name || '' }))
    )).catch(() => {})
  }, [])

  // Auto-fetch on mount
  useEffect(() => { fetchList() }, [fetchList])

  const handleApplyFilter = useCallback(() => { fetchList() }, [fetchList])

  const handleView = useCallback(async (id: string) => {
    await fetchById(id)
    setShowDetail(true)
  }, [fetchById])

  const handleCreate = useCallback(async (dto: CreateCashCountDto) => {
    try {
      await create(dto)
      toast.success('Cash count berhasil dibuat')
      setShowCreate(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membuat cash count')
    }
  }, [create, toast])

  const handleCount = useCallback(async (id: string, dto: UpdatePhysicalCountDto) => {
    try {
      await updatePhysicalCount(id, dto)
      toast.success('Hitung fisik berhasil disimpan')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal simpan hitung fisik')
    }
  }, [updatePhysicalCount, toast])

  const handleDeposit = useCallback(async (id: string, dto: DepositDto) => {
    try {
      await deposit(id, dto)
      toast.success('Setoran berhasil dicatat')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal catat setoran')
    }
  }, [deposit, toast])

  const handleClose = useCallback(async (id: string) => {
    try {
      await close(id)
      toast.success('Cash count berhasil ditutup')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal tutup cash count')
    }
  }, [close, toast])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await remove(deleteTarget.id)
      toast.success('Cash count berhasil dihapus')
      setDeleteTarget(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal hapus cash count')
    }
  }, [deleteTarget, remove, toast])

  return (
    <div className="p-4 lg:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-600 rounded-xl">
            <Coins className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-gray-900 dark:text-white">Cash Count</h1>
            <p className="text-[10px] text-gray-400">Hitung fisik kas vs system balance POS</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg text-[10px] font-semibold hover:bg-amber-700 transition-all">
          <Plus className="w-3.5 h-3.5" /> Buat Cash Count
        </button>
      </div>

      {/* Filters */}
      <CashCountFilters filter={filter} onFilterChange={setFilter} onApply={handleApplyFilter} isLoading={isLoading} />

      {/* Table */}
      <CashCountTable
        items={items}
        isLoading={isLoading}
        pagination={{ page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 }}
        onPageChange={setPage}
        onLimitChange={setLimit}
        onView={handleView}
        onDelete={setDeleteTarget}
      />

      {/* Create Modal */}
      <CashCountCreateModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        branches={branches}
        paymentMethods={paymentMethods}
        isLoading={isMutating}
      />

      {/* Detail Panel */}
      {selected && (
        <CashCountDetailPanel
          item={selected}
          isOpen={showDetail}
          onClose={() => setShowDetail(false)}
          onCount={handleCount}
          onDeposit={handleDeposit}
          onCloseCount={handleClose}
          employees={employees}
          bankAccounts={bankAccounts}
          isLoading={isMutating}
        />
      )}

      {/* Delete Confirm */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Cash Count"
        message="Apakah Anda yakin ingin menghapus cash count ini? Hanya cash count dengan status OPEN yang bisa dihapus."
        confirmText="Hapus"
        variant="danger"
        isLoading={isMutating}
      />
    </div>
  )
}
