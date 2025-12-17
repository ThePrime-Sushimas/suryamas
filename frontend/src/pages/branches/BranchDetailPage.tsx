import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { branchService } from '@/services/branchService'
import { companyService } from '@/services/companyService'
import api from '@/lib/axios'
import type { Branch } from '@/types/branch'

interface Employee {
  id: string
  employee_id: string
  full_name: string
  job_position: string
  email: string | null
}

function BranchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [branch, setBranch] = useState<Branch | null>(null)
  const [companyName, setCompanyName] = useState<string>('')
  const [managerName, setManagerName] = useState<string>('')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [activeTab, setActiveTab] = useState<'details' | 'employees'>('details')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBranch = async () => {
      try {
        const res = await branchService.getById(id!)
        setBranch(res.data.data)
        
        const promises = []
        if (res.data.data.company_id) {
          promises.push(
            companyService.getById(res.data.data.company_id)
              .then(r => setCompanyName(r.data.data.company_name))
              .catch(() => setCompanyName('Not found'))
          )
        }
        if (res.data.data.manager_id) {
          promises.push(
            api.get<{ success: boolean; data: { full_name: string } }>(`/employees/${res.data.data.manager_id}`)
              .then(r => setManagerName(r.data.data.full_name))
              .catch(() => setManagerName('Not found'))
          )
        }
        promises.push(
          api.get<{ success: boolean; data: { data: Employee[] } }>(`/employees/search?branch_id=${id}&limit=100`)
            .then(r => {
              setEmployees(r.data.data?.data || [])
            })
            .catch(() => {})
        )
        await Promise.all(promises)
      } catch (error) {
      } finally {
        setLoading(false)
      }
    }

    if (id) fetchBranch()
  }, [id])

  const handleTabChange = (tab: 'details' | 'employees') => {
    setActiveTab(tab)
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (!branch) return <div className="p-6">Branch not found</div>

  return (
    <div className="p-6">
      <button onClick={() => navigate('/branches')} className="mb-4 text-blue-600 hover:underline">
        ← Back
      </button>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">{branch.branch_name}</h1>
          <div className="space-x-2">
            <button
              onClick={() => navigate(`/branches/${id}/edit`)}
              className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm('Delete this branch?')) {
                  branchService.delete(id!).then(() => navigate('/branches'))
                }
              }}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        </div>

        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => handleTabChange('details')}
            className={`px-4 py-2 font-medium ${activeTab === 'details' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            Details
          </button>
          <button
            onClick={() => handleTabChange('employees')}
            className={`px-4 py-2 font-medium ${activeTab === 'employees' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600'}`}
          >
            Employees ({employees.length})
          </button>
        </div>

        {activeTab === 'details' && (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-600">Code</p>
              <p className="font-semibold">{branch.branch_code}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="font-semibold">{branch.status}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Company</p>
              <p className="font-semibold">{companyName || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Manager</p>
              <p className="font-semibold">{managerName || '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-600">Address</p>
              <p className="font-semibold">{branch.address}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">City</p>
              <p className="font-semibold">{branch.city}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Province</p>
              <p className="font-semibold">{branch.province}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Postal Code</p>
              <p className="font-semibold">{branch.postal_code || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Country</p>
              <p className="font-semibold">{branch.country}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Phone</p>
              <p className="font-semibold">{branch.phone || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">WhatsApp</p>
              <p className="font-semibold">{branch.whatsapp || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-semibold">{branch.email || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Jam Buka</p>
              <p className="font-semibold">{branch.jam_buka}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Jam Tutup</p>
              <p className="font-semibold">{branch.jam_tutup}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Hari Operasional</p>
              <p className="font-semibold">{branch.hari_operasional}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Latitude</p>
              <p className="font-semibold">{branch.latitude || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Longitude</p>
              <p className="font-semibold">{branch.longitude || '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-600">Notes</p>
              <p className="font-semibold">{branch.notes || '-'}</p>
            </div>
          </div>
        )}

        {activeTab === 'employees' && (
          <div>
            {employees.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Employee ID</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Name</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Position</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm">{emp.employee_id}</td>
                        <td className="px-4 py-2 text-sm font-medium">
                          <button
                            onClick={() => navigate(`/employees/${emp.id}`)}
                            className="text-blue-600 hover:underline"
                          >
                            {emp.full_name}
                          </button>
                        </td>
                        <td className="px-4 py-2 text-sm">{emp.job_position}</td>
                        <td className="px-4 py-2 text-sm">{emp.email || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No employees found in this branch</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default BranchDetailPage
