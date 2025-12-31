import { useNavigate } from 'react-router-dom'
import { useProductsStore } from '../store/products.store'
import { ProductForm } from '../components/ProductForm'
import { useToast } from '@/contexts/ToastContext'

export default function CreateProductPage() {
  const navigate = useNavigate()
  const { createProduct, loading } = useProductsStore()
  const { success, error } = useToast()

  const handleSubmit = async (data: any) => {
    try {
      await createProduct(data)
      success('Product created successfully')
      navigate('/products')
    } catch (err: unknown) {
      error(err.response?.data?.error || 'Failed to create product')
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Create Product</h1>
      <ProductForm onSubmit={handleSubmit} isLoading={loading} />
    </div>
  )
}
