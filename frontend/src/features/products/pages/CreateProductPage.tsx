import { useNavigate } from 'react-router-dom'
import { useProductsStore } from '../store/products.store'
import { ProductForm } from '../components/ProductForm'

export default function CreateProductPage() {
  const navigate = useNavigate()
  const { createProduct, loading } = useProductsStore()

  const handleSubmit = async (data: any) => {
    try {
      await createProduct(data)
      alert('Product created successfully')
      navigate('/products')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create product')
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Create Product</h1>
      <ProductForm onSubmit={handleSubmit} isLoading={loading} />
    </div>
  )
}
