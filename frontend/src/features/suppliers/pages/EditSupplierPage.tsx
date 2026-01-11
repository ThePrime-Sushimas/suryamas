import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSuppliersStore } from '../store/suppliers.store'
import { suppliersApi } from '../api/suppliers.api'
import { useToast } from '@/contexts/ToastContext'
import { SupplierForm } from '../components/SupplierForm'
import type { UpdateSupplierDto, Supplier } from '../types/supplier.types'

export function EditSupplierPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { updateSupplier, mutationLoading } = useSuppliersStore()
  const toast = useToast()
  
  const [loading, setLoading] = useState(true)
  const [supplier, setSupplier] = useState<Supplier | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!id) {
        toast.error('Invalid supplier ID')
        navigate('/suppliers')
        return
      }

      try {
        const data = await suppliersApi.getById(id)
        setSupplier(data)
      } catch (error) {
        console.error('Failed to load supplier:', error)
        toast.error('Failed to load supplier')
        navigate('/suppliers')
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [id, navigate, toast])

  const handleSubmit = async (data: UpdateSupplierDto) => {
    try {
      await updateSupplier(id!, data)
      toast.success('Supplier updated successfully')
      navigate('/suppliers')
    } catch {
      toast.error('Failed to update supplier')
    }
  }

  const handleCancel = () => {
    navigate('/suppliers')
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!supplier) {
    return null
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Supplier</h1>
        <p className="text-gray-600 mt-1">Update supplier information</p>
      </div>

      <SupplierForm
        initialData={supplier}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        submitLabel="Update Supplier"
        isEdit
        loading={mutationLoading}
      />
    </div>
  )
}
