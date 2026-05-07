import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Truck } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useCreateSupplier } from '../api/suppliers.api'
import { SupplierForm } from '../components/SupplierForm'
import type { CreateSupplierDto, UpdateSupplierDto } from '../types/supplier.types'

export function CreateSupplierPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createSupplier = useCreateSupplier()
  const [cancelOpen, setCancelOpen] = useState(false)

  const handleSubmit = async (data: CreateSupplierDto | UpdateSupplierDto) => {
    try {
      await createSupplier.mutateAsync(data as CreateSupplierDto)
      toast.success('Supplier berhasil dibuat')
      navigate('/suppliers')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal membuat supplier')) }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-6 space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/suppliers')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <Truck className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah Supplier Baru</h1>
          <p className="text-xs text-gray-400">Buat data supplier baru</p>
        </div>
      </div>

      {/* Form */}
      <SupplierForm onSubmit={handleSubmit} onCancel={() => setCancelOpen(true)} submitLabel="Buat Supplier" loading={createSupplier.isPending} />

      <ConfirmModal isOpen={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={() => navigate('/suppliers')}
        title="Batalkan" message="Yakin ingin membatalkan? Data yang diisi akan hilang." confirmText="Ya, Batalkan" variant="danger" />
    </div>
  )
}
