import { useEffect, useState } from 'react'
import { Building2, Shield, DollarSign } from 'lucide-react'
import api from '@/lib/axios'

interface BranchAssignment {
  id: string
  branch_id: string
  branch_name: string
  branch_code: string
  role_id: string
  role_name: string
  approval_limit: number
  is_primary: boolean
  status: string
}

interface Props {
  employeeId: string
}

export function EmployeeBranchAccessTab({ employeeId }: Props) {
  const [branches, setBranches] = useState<BranchAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const { data } = await api.get<{ success: boolean; data: BranchAssignment[] }>(`/employee-branches/employee/${employeeId}`)
        setBranches(data.data || [])
      } catch (err) {
        setBranches([])
      } finally {
        setIsLoading(false)
      }
    }
    fetchBranches()
  }, [employeeId])

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (branches.length === 0) {
    return (
      <div className="text-center py-8">
        <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No branch access assigned</p>
      </div>
    )
  }

  const sortedBranches = [...branches].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    return a.branch_name.localeCompare(b.branch_name)
  })

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Branch</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Approval Limit</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sortedBranches.map((branch) => (
            <tr key={branch.id} className={branch.is_primary ? 'bg-blue-50' : ''}>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <div>
                    <span className="font-medium text-gray-900">{branch.branch_name}</span>
                    <span className="text-xs text-gray-500 ml-1">({branch.branch_code})</span>
                  </div>
                  {branch.is_primary && (
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      Primary
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900">{branch.role_name}</span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-900">
                    {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(branch.approval_limit)}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  branch.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {branch.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
