import { useNavigate } from 'react-router-dom'
import { useSuppliersStore } from '../store/suppliers.store'
import { useToast } from '@/contexts/ToastContext'
import { SupplierForm } from '../components/SupplierForm'
import type { CreateSupplierDto, UpdateSupplierDto } from '../types/supplier.types'

export function CreateSupplierPage() {
  const navigate = useNavigate()
  const { createSupplier, mutationLoading } = useSuppliersStore()
  const toast = useToast()

  const handleSubmit = async (data: CreateSupplierDto | UpdateSupplierDto) => {
    try {
      await createSupplier(data as CreateSupplierDto)
      toast.success('Supplier created successfully')
      navigate('/suppliers')
    } catch {
      toast.error('Failed to create supplier')
    }
  }

  const handleCancel = () => {
    navigate('/suppliers')
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add New Supplier</h1>
        <p className="text-gray-600 mt-1">Create a new supplier record</p>
      </div>

      <SupplierForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        submitLabel="Create Supplier"
        loading={mutationLoading}
      />
    </div>
  )
}