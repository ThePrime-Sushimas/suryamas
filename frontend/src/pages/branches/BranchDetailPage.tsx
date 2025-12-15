import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { branchService } from '@/services/branchService'
import type { Branch } from '@/types/branch'

function BranchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [branch, setBranch] = useState<Branch | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBranch = async () => {
      try {
        const res = await branchService.getById(id!)
        setBranch(res.data.data)
      } catch (error) {
        console.error('Failed to fetch branch')
      } finally {
        setLoading(false)
      }
    }

    if (id) fetchBranch()
  }, [id])

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
            <p className="text-sm text-gray-600">Company ID</p>
            <p className="font-semibold">{branch.company_id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Manager ID</p>
            <p className="font-semibold">{branch.manager_id || '-'}</p>
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
            <p className="text-sm text-gray-600">24 Hour</p>
            <p className="font-semibold">{branch.is_24_jam ? 'Yes' : 'No'}</p>
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
      </div>
    </div>
  )
}

export default BranchDetailPage
