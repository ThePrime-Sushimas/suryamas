import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, DollarSign } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { FormSkeleton } from '@/components/ui/Skeleton'
import { useBranchContextStore } from '@/features/branch_context/store/branchContext.store'
import { usePricelist, useUpdatePricelist } from '../api/pricelists.api'
import { PricelistFormContextual } from '../components/PricelistFormContextual'
import { isEditable } from '../constants/pricelist.constants'
import type { CreatePricelistDto, UpdatePricelistDto } from '../types/pricelist.types'

export const EditPricelistPage = function EditPricelistPage() {
  const { id, supplierProductId, pricelistId } = useParams<{ id?: string; supplierProductId?: string; pricelistId?: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const actualId = pricelistId || id || ''
  const backPath = supplierProductId ? `/supplier-products/${supplierProductId}/pricelists` : '/pricelists'
  const currentBranch = useBranchContextStore(s => s.currentBranch)

  const pricelist = usePricelist(actualId)
  const updatePL = useUpdatePricelist()

  const handleSubmit = async (data: CreatePricelistDto | UpdatePricelistDto) => {
    if (!actualId || !pricelist.data) return
    if (!isEditable(pricelist.data.status)) { toast.error('Pricelist ini tidak bisa diedit'); return }
    try {
      await updatePL.mutateAsync({ id: actualId, ...data as UpdatePricelistDto })
      toast.success('Pricelist berhasil diperbarui')
      navigate(backPath)
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal mengupdate pricelist')) }
  }

  if (pricelist.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center gap-3"><div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /><div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /><div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6"><FormSkeleton /></div>
        </div>
      </div>
    )
  }

  if (!pricelist.data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
          <DollarSign className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Pricelist tidak ditemukan</h3>
          <button onClick={() => navigate(backPath)} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Kembali</button>
        </div>
      </div>
    )
  }

  const p = pricelist.data

  if (!isEditable(p.status)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
        <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
          <p className="text-red-600 font-medium">Pricelist dengan status "{p.status}" tidak bisa diedit</p>
          <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">Buat pricelist baru jika perlu mengubah harga.</p>
          <button onClick={() => navigate(backPath)} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Kembali</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(backPath)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <DollarSign className="w-6 h-6 text-green-600" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Pricelist</h1>
            <p className="text-xs text-gray-400">{p.supplier?.supplier_name} → {p.product?.product_name}</p>
          </div>
        </div>

        <PricelistFormContextual
          initialData={p}
          onSubmit={handleSubmit}
          onCancel={() => navigate(backPath)}
          submitLabel="Simpan Perubahan"
          isEdit={true}
          submitting={updatePL.isPending}
          companyId={currentBranch?.company_id || ''}
          supplierId={p.supplier_id}
          productId={p.product_id}
          supplierName={p.supplier?.supplier_name}
          productName={p.product?.product_name}
        />
      </div>
    </div>
  )
}
