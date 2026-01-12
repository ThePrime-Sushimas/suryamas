import { Link } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'
import { useBranchContext } from '@/features/branch_context'
import { Building2, Users, Shield, Package, CreditCard, FileText, Settings, BarChart3 } from 'lucide-react'
import { useState, useEffect } from 'react'
import api from '@/lib/axios'

interface DashboardStats {
  companies: number
  employees: number
  products: number
}

export default function HomePage() {
  const { user } = useAuthStore()
  const currentBranch = useBranchContext()
  const [stats, setStats] = useState<DashboardStats>({ companies: 0, employees: 0, products: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      if (!currentBranch?.company_id) return
      
      try {
        const [companiesRes, employeesRes, productsRes] = await Promise.all([
          api.get('/companies', { params: { limit: 1000 } }),
          api.get('/employees', { params: { company_id: currentBranch.company_id, limit: 1000 } }),
          api.get('/products', { params: { company_id: currentBranch.company_id, limit: 1000 } })
        ])
        
        setStats({
          companies: companiesRes.data.pagination?.total || companiesRes.data.data?.length || 0,
          employees: employeesRes.data.pagination?.total || employeesRes.data.data?.length || 0,
          products: productsRes.data.pagination?.total || productsRes.data.data?.length || 0
        })
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [currentBranch?.company_id])

  const quickActions = [
    { title: 'Chart of Accounts', href: '/chart-of-accounts', icon: FileText, color: 'text-blue-600', bg: 'hover:bg-blue-50' },
    { title: 'Products', href: '/products', icon: Package, color: 'text-green-600', bg: 'hover:bg-green-50' },
    { title: 'Suppliers', href: '/suppliers', icon: Building2, color: 'text-purple-600', bg: 'hover:bg-purple-50' },
    { title: 'Employees', href: '/employees', icon: Users, color: 'text-orange-600', bg: 'hover:bg-orange-50' },
    { title: 'Companies', href: '/companies', icon: Building2, color: 'text-indigo-600', bg: 'hover:bg-indigo-50' },
    { title: 'Pricelists', href: '/pricelists', icon: CreditCard, color: 'text-pink-600', bg: 'hover:bg-pink-50' },
    { title: 'Permissions', href: '/permissions', icon: Shield, color: 'text-red-600', bg: 'hover:bg-red-50' },
    { title: 'Settings', href: '/settings/banks', icon: Settings, color: 'text-gray-600', bg: 'hover:bg-gray-50' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* Container */}
      <div className="flex-grow max-w-7xl mx-auto w-full px-6 py-12">
        
        {/* Header */}
        <div className="text-center mb-16">
          <div className="flex justify-center items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">S</div>
            <h1 className="text-5xl font-extrabold text-gray-900">Suryamas</h1>
          </div>
          <p className="text-2xl text-gray-700 mb-2">Finance Management System</p>
          <p className="text-gray-500">Comprehensive business management solution</p>
        </div>

        {/* Main Section */}
        {user ? (
          <div className="space-y-8">
            {/* Welcome Card */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-3xl font-bold mb-2">Welcome back, {user.full_name}!</h2>
                  <p className="text-gray-600 text-lg">{user.job_position}</p>
                  {currentBranch && (
                    <p className="text-sm text-blue-600 mt-2">
                      Current Branch: {currentBranch.branch_name}
                    </p>
                  )}
                </div>
                <div className="mt-4 md:mt-0">
                  <Link
                    to="/profile"
                    className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
                  >
                    <Users className="w-5 h-5 mr-2" />
                    View Profile
                  </Link>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold mb-8 flex items-center">
                <BarChart3 className="w-6 h-6 mr-3 text-blue-600" />
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {quickActions.map((action) => {
                  const Icon = action.icon
                  return (
                    <Link
                      key={action.href}
                      to={action.href}
                      className={`bg-white border-2 border-gray-100 rounded-xl p-6 flex flex-col items-center justify-center ${action.bg} hover:shadow-lg hover:border-gray-200 transform hover:-translate-y-1 transition-all duration-300`}
                    >
                      <Icon className={`w-8 h-8 ${action.color} mb-3`} />
                      <span className="text-sm font-semibold text-gray-800 text-center">{action.title}</span>
                    </Link>
                  )
                })}
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center">
                  <div className="p-4 bg-blue-100 rounded-full">
                    <Building2 className="w-8 h-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600 font-medium">Active Companies</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {loading ? '...' : stats.companies.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center">
                  <div className="p-4 bg-green-100 rounded-full">
                    <Users className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600 font-medium">Total Employees</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {loading ? '...' : stats.employees.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center">
                  <div className="p-4 bg-purple-100 rounded-full">
                    <Package className="w-8 h-8 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm text-gray-600 font-medium">Total Products</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {loading ? '...' : stats.products.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-12 text-center">
            <div className="mb-8">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto mb-6">S</div>
              <h2 className="text-3xl font-bold mb-4">Welcome to Suryamas</h2>
              <p className="text-gray-600 text-lg mb-8">Please login or register to access the finance management system</p>
            </div>
            <div className="flex flex-col sm:flex-row justify-center gap-6">
              <Link
                to="/login"
                className="bg-blue-600 text-white px-10 py-4 rounded-lg hover:bg-blue-700 font-semibold transition-colors text-lg"
              >
                Login to Continue
              </Link>
              <Link
                to="/register"
                className="bg-gray-600 text-white px-10 py-4 rounded-lg hover:bg-gray-700 font-semibold transition-colors text-lg"
              >
                Create Account
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-6 text-center text-gray-500 text-sm">
        © {new Date().getFullYear()} CV Suryamas Pangan. All rights reserved.
      </footer>
    </div>
  )
}