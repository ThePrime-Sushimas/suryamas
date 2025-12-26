import { Link } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'

interface MobileDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export default function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const { user } = useAuthStore()

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl z-50 transform transition-transform duration-300">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Menu</h2>
            <button onClick={onClose} className="text-gray-600 text-2xl">&times;</button>
          </div>
        </div>
        <nav className="p-4 space-y-2">
          {user && (
            <>
              <Link to="/" onClick={onClose} className="block py-3 px-4 rounded hover:bg-gray-100">
                Home
              </Link>
              <Link to="/employees" onClick={onClose} className="block py-3 px-4 rounded hover:bg-gray-100">
                Employees
              </Link>
              <Link to="/companies" onClick={onClose} className="block py-3 px-4 rounded hover:bg-gray-100">
                Companies
              </Link>
              <Link to="/branches" onClick={onClose} className="block py-3 px-4 rounded hover:bg-gray-100">
                Branches
              </Link>
              <Link to="/categories" onClick={onClose} className="block py-3 px-4 rounded hover:bg-gray-100">
                Categories
              </Link>
              <Link to="/products" onClick={onClose} className="block py-3 px-4 rounded hover:bg-gray-100">
                Products
              </Link>
              <Link to="/employee-branches" onClick={onClose} className="block py-3 px-4 rounded hover:bg-gray-100">
                Employee Branches
              </Link>
              <Link to="/permissions" onClick={onClose} className="block py-3 px-4 rounded hover:bg-gray-100">
                Permissions
              </Link>
              <Link to="/users" onClick={onClose} className="block py-3 px-4 rounded hover:bg-gray-100">
                Users
              </Link>
              <Link to="/profile" onClick={onClose} className="block py-3 px-4 rounded hover:bg-gray-100">
                Profile
              </Link>
            </>
          )}
        </nav>
      </div>
    </>
  )
}
