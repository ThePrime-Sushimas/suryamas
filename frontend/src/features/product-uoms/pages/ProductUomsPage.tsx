import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Package, Plus, ArrowLeft, X } from 'lucide-react'
import { useProductUoms, useCreateProductUom, useUpdateProductUom, useDeleteProductUom, useRestoreProductUom } from '../api/productUoms.api'
import { ProductUomTable } from '../components/ProductUomTable'
import { ProductUomForm } from '../components/ProductUomForm'
import type { ProductUom, CreateProductUomDto, UpdateProductUomDto } from '../types'

export default function ProductUomsPage() {
  const { productId } = useParams<{ productId: string }>()
  const navigate = useNavigate()
  const toast = useToast()

  const [showForm, setShowForm] = useState(false)
  const [editingUom, setEditingUom] = useState<ProductUom | undefined>()
  const [showDeleted, setShowDeleted] = useState(false)
  const [deleteData, setDeleteData] = useState<{ id: string; name: string } | null>(null)
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)

  const { data: uoms = [], isLoading } = useProductUoms(productId || '', showDeleted)
  const createUom = useCreateProductUom(productId || '')
  const updateUom = useUpdateProductUom(productId || '')
  const deleteUom = useDeleteProductUom(productId || '')
  const restoreUom = useRestoreProductUom(productId || '')

  const isMutating = createUom.isPending || updateUom.isPending || deleteUom.isPending || restoreUom.isPending

  const handleCreate = async (data: CreateProductUomDto | UpdateProductUomDto) => {
    try {
      await createUom.mutateAsync(data as CreateProductUomDto)
      toast.success('Satuan berhasil dibuat')
      setShowForm(false)
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal membuat satuan')) }
  }

  const handleUpdate = async (data: CreateProductUomDto | UpdateProductUomDto) => {
    if (!editingUom) return
    try {
      await updateUom.mutateAsync({ uomId: editingUom.id, ...data as UpdateProductUomDto })
      toast.success('Satuan berhasil diperbarui')
      setEditingUom(undefined)
      setShowForm(false)
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal memperbarui satuan')) }
  }

  const handleConfirmDelete = async () => {
    if (!deleteData) return
    try {
      await deleteUom.mutateAsync(deleteData.id)
      toast.success('Satuan berhasil dihapus')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal menghapus satuan')) }
    finally { setDeleteData(null) }
  }

  const handleRestore = async (uomId: string) => {
    try {
      await restoreUom.mutateAsync(uomId)
      toast.success('Satuan berhasil dipulihkan')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal memulihkan satuan')) }
  }

  const handleCancel = () => {
    if (showForm && editingUom) { setShowDiscardConfirm(true); return }
    setShowForm(false); setEditingUom(undefined)
  }

  if (!productId) return <div className="h-screen flex items-center justify-center"><p className="text-red-500">Product ID is required</p></div>

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/products')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" disabled={isMutating}>
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <Package className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Satuan Produk</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">{uoms.length} satuan ukur</p>
            </div>
          </div>
          {!showForm && (
            <button onClick={() => setShowForm(true)} disabled={isMutating || isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
              <Plus className="w-4 h-4" /> Tambah Satuan
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {showForm ? (
          <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingUom ? 'Edit Satuan' : 'Buat Satuan Baru'}
              </h2>
              <button onClick={handleCancel} disabled={isMutating} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded disabled:opacity-50">
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <ProductUomForm uom={editingUom} existingUoms={uoms} onSubmit={editingUom ? handleUpdate : handleCreate} onCancel={handleCancel} loading={isMutating} />
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <input type="checkbox" checked={showDeleted} onChange={e => setShowDeleted(e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 bg-white dark:bg-gray-700" />
                Tampilkan Dihapus
              </label>
            </div>
            <ProductUomTable uoms={uoms} onEdit={uom => { setEditingUom(uom); setShowForm(true) }}
              onDelete={uom => setDeleteData({ id: uom.id, name: uom.metric_units?.unit_name || 'satuan ini' })}
              onRestore={handleRestore} loading={isLoading} />
          </div>
        )}
      </div>

      <ConfirmModal isOpen={!!deleteData} onClose={() => setDeleteData(null)} onConfirm={handleConfirmDelete}
        title="Hapus Satuan" message={`Yakin ingin menghapus "${deleteData?.name}"?`}
        confirmText="Hapus" variant="danger" isLoading={deleteUom.isPending} />

      <ConfirmModal isOpen={showDiscardConfirm} onClose={() => setShowDiscardConfirm(false)}
        onConfirm={() => { setShowDiscardConfirm(false); setShowForm(false); setEditingUom(undefined) }}
        title="Buang Perubahan" message="Buang perubahan yang belum disimpan?" confirmText="Buang" variant="warning" />
    </div>
  )
}
