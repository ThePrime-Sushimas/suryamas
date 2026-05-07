import { useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCreateSupplier } from '../api/suppliers.api'
import { SupplierForm } from '../components/SupplierForm'
import { ArrowLeft } from 'lucide-react'
import type { CreateSupplierDto, UpdateSupplierDto } from '../types/supplier.types'

export function CreateSupplierPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createSupplier = useCreateSupplier()

  const handleSubmit = async (data: CreateSupplierDto | UpdateSupplierDto) => {
    try {
      await createSupplier.mutateAsync(data as CreateSupplierDto)
      toast.success('Supplier berhasil dibuat')
      navigate('/suppliers')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal membuat supplier')) }
  }

  return (
    <div className="px-4 py-6 sm:p-6 max-w-4xl mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
      <button onClick={() => navigate('/suppliers')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 mb-6">
        <ArrowLeft size={20} />
      </button>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tambah Supplier Baru</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Buat data supplier baru</p>
      </div>
      <SupplierForm onSubmit={handleSubmit} onCancel={() => navigate('/suppliers')} submitLabel="Buat Supplier" loading={createSupplier.isPending} />
    </div>
  )
}
