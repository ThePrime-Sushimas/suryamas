import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSuppliersStore } from '../store/suppliers.store'
import { suppliersApi } from '../api/suppliers.api'
import { useToast } from '@/contexts/ToastContext'
import { SupplierForm } from '../components/SupplierForm'
import { ArrowLeft } from 'lucide-react'
import type { UpdateSupplierDto, Supplier } from '../types/supplier.types'

export function EditSupplierPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { updateSupplier, mutationLoading } = useSuppliersStore()
  const toast = useToast()
  
  const [loading, setLoading] = useState(true)
  const [supplier, setSupplier] = useState<Supplier | null>(null)

  useEffect(() => {
    if (!id) {
      toast.error('ID supplier tidak valid')
      navigate('/suppliers')
      return
    }

    suppliersApi.getById(id)
      .then(setSupplier)
      .catch(() => {
        toast.error('Gagal memuat data supplier')
        navigate('/suppliers')
      })
      .finally(() => setLoading(false))
  }, [id, navigate, toast])

  const handleSubmit = async (data: UpdateSupplierDto) => {
    try {
      await updateSupplier(id!, data)
      toast.success('Supplier berhasil diperbarui')
      navigate('/suppliers')
    } catch {
      toast.error('Gagal memperbarui supplier')
    }
  }

  if (loading) {
    return (
      <div className="px-4 py-6 sm:p-6 max-w-4xl mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-6" />
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-6" />
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!supplier) return null

  return (
    <div className="px-4 py-6 sm:p-6 max-w-4xl mx-auto bg-gray-50 dark:bg-gray-900 min-h-screen">
      <button
        onClick={() => navigate('/suppliers')}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-400 mb-6"
      >
        <ArrowLeft size={20} />
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Supplier</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Perbarui informasi supplier</p>
      </div>

      <SupplierForm
        initialData={supplier}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/suppliers')}
        submitLabel="Simpan Perubahan"
        isEdit
        loading={mutationLoading}
      />
    </div>
  )
}
