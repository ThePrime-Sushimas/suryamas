import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, PackageSearch } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useSupplier, useUpdateSupplier } from '../api/suppliers.api'
import { SupplierForm } from '../components/SupplierForm'
import { BankAccountsSection } from '@/features/bank-accounts'
import { FormSkeleton } from '@/components/ui/Skeleton'
import { SupplierTypeBadge } from '../components/SupplierTypeBadge'
import type { UpdateSupplierDto } from '../types/supplier.types'

export function EditSupplierPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const supplier = useSupplier(id || '')
  const updateSupplier = useUpdateSupplier()

  const handleSubmit = async (data: UpdateSupplierDto) => {
    if (!id) return
    try {
      await updateSupplier.mutateAsync({ id, ...data })
      toast.success('Supplier berhasil diperbarui')
      navigate('/suppliers')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal memperbarui supplier')) }
  }

  if (supplier.isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4 lg:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
              <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
              <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"><FormSkeleton /></div>
      </div>
    )
  }

  if (!supplier.data) {
    return (
      <div className="max-w-4xl mx-auto p-4 lg:p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
          <PackageSearch className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Supplier tidak ditemukan</h3>
          <button onClick={() => navigate('/suppliers')} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Kembali</button>
        </div>
      </div>
    )
  }

  const s = supplier.data

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-6 space-y-4 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/suppliers')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
          <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{s.supplier_name}</h1>
          <p className="text-xs text-gray-400">{s.supplier_code}</p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Tipe</p>
          <div className="mt-1"><SupplierTypeBadge type={s.supplier_type} /></div>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Status</p>
          <p className={`text-lg font-bold ${s.is_active ? 'text-emerald-600' : 'text-gray-500'}`}>
            {s.is_active ? 'Aktif' : 'Nonaktif'}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Rating</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {s.rating ? '⭐'.repeat(s.rating) : '—'}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Kontak</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{s.contact_person}</p>
          <p className="text-xs text-gray-400 truncate">{s.phone}</p>
        </div>
      </div>

      {/* Form */}
      <SupplierForm initialData={s} onSubmit={handleSubmit} onCancel={() => navigate('/suppliers')} submitLabel="Simpan Perubahan" isEdit loading={updateSupplier.isPending} />

      {/* Bank Accounts */}
      <BankAccountsSection ownerType="supplier" ownerId={id!} />
    </div>
  )
}
