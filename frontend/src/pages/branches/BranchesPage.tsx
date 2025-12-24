import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { branchService } from '@/services/branchService'
import { BranchTable } from '@/components/branches/BranchTable'
import type { Branch } from '@/types/branch'
import { 
  Search, 
  Building, 
  Plus,
  Loader2,
  AlertCircle
} from 'lucide-react'

function BranchesPage() {
  const navigate = useNavigate()
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Record<string, any>>({})
  const [error, setError] = useState<string | null>(null)

  const fetchBranches = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = search
        ? await branchService.search(search, 1, 1000, filter)
        : await branchService.list(1, 1000, undefined, filter)
      setBranches(res.data.data)
    } catch (error) {
      console.error('Failed to fetch branches')
      setError('Failed to load branches. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBranches()
  }, [search, JSON.stringify(filter)])

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this branch?')) {
      try {
        await branchService.delete(id)
        fetchBranches()
      } catch (error) {
        console.error('Delete failed')
        setError('Failed to delete branch. Please try again.')
      }
    }
  }

  const setFilterKey = (key: string, value?: string) => {
    setFilter(prev => {
      const next = { ...prev }
      if (!value) delete next[key]
      else next[key] = value
      return next
    })
  }

  const handleClearFilters = () => {
    setSearch('')
    setFilter({})
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <Building className="h-8 w-8 text-blue-600" />
                Branches Management
              </h1>
              <p className="text-gray-600 mt-2">Manage and monitor all your branches in one place</p>
            </div>
            <button
              onClick={() => navigate('/branches/new')}
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl font-medium group"
            >
              <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-200" />
              Add New Branch
            </button>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search branches by name, city, or address..."
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value)
                  }}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
                />
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <select
                value={filter.status || ''}
                onChange={e => setFilterKey('status', e.target.value || undefined)}
                className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
              >
                <option value="">All Status</option>
                <option value="active">
                  
                  Active
                </option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
                <option value="closed">Closed</option>
              </select>

              <select
                value={filter.city || ''}
                onChange={e => setFilterKey('city', e.target.value || undefined)}
                className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200"
              >
                <option value="">All Cities</option>
                <option value="Jakarta">Jakarta</option>
                <option value="Surabaya">Surabaya</option>
                <option value="Bandung">Bandung</option>
                <option value="Medan">Medan</option>
                <option value="Semarang">Semarang</option>
              </select>

              {(search || Object.keys(filter).length > 0) && (
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {/* Active Filters Badges */}
          <div className="flex flex-wrap gap-2">
            {search && (
              <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                Search: {search}
                <button onClick={() => setSearch('')} className="ml-1 hover:text-blue-900">×</button>
              </span>
            )}
            {filter.status && (
              <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-sm px-3 py-1 rounded-full">
                Status: {filter.status}
                <button onClick={() => setFilterKey('status')} className="ml-1 hover:text-green-900">×</button>
              </span>
            )}
            {filter.city && (
              <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-sm px-3 py-1 rounded-full">
                City: {filter.city}
                <button onClick={() => setFilterKey('city')} className="ml-1 hover:text-purple-900">×</button>
              </span>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-red-700">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600 text-lg">Loading branches...</p>
          </div>
        ) : (
          <>
            {/* Table Section */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Branch List</h2>
                <p className="text-gray-600 text-sm mt-1">
                  Total: {branches.length} branches
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <BranchTable
                  branches={branches}
                  onView={id => navigate(`/branches/${id}`)}
                  onEdit={id => navigate(`/branches/${id}/edit`)}
                  onDelete={handleDelete}
                  canEdit={true}
                  canDelete={true}
                />
              </div>
            </div>


          </>
        )}
      </div>
    </div>
  )
}

export default BranchesPage