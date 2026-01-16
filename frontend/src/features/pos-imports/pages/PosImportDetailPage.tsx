import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { posImportsApi } from '../api/pos-imports.api'
import type { PosImport, PosImportLine } from '../types/pos-imports.types'

export function PosImportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [posImport, setPosImport] = useState<PosImport | null>(null)
  const [lines, setLines] = useState<PosImportLine[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 50

  useEffect(() => {
    if (!id) return
    
    const fetchData = async () => {
      try {
        setLoading(true)
        const [importRes, linesRes] = await Promise.all([
          posImportsApi.getById(id),
          posImportsApi.getLines(id, page, limit)
        ])
        setPosImport(importRes.data)
        setLines(linesRes.data)
        setTotal(linesRes.pagination?.total || 0)
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id, page])

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (!posImport) {
    return <div className="p-6">Import not found</div>
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      <button
        onClick={() => navigate('/pos-imports')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Imports
      </button>

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-2xl font-bold mb-4">Import Details</h1>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">File Name</p>
            <p className="font-medium">{posImport.file_name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className="font-medium">{posImport.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Date Range</p>
            <p className="font-medium">
              {new Date(posImport.date_range_start).toLocaleDateString()} - {new Date(posImport.date_range_end).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Rows</p>
            <p className="font-medium">{posImport.total_rows}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold">Transaction Lines ({total})</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bill Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Menu</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Discount</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tax</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {lines.map((line) => (
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{line.bill_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(line.sales_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{line.branch || '-'}</td>
                  <td className="px-4 py-3 text-sm">{line.menu || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{line.payment_method || '-'}</td>
                  <td className="px-4 py-3 text-sm text-right">{line.qty || 0}</td>
                  <td className="px-4 py-3 text-sm text-right">{line.price?.toLocaleString() || 0}</td>
                  <td className="px-4 py-3 text-sm text-right">{line.subtotal?.toLocaleString() || 0}</td>
                  <td className="px-4 py-3 text-sm text-right text-red-600">{line.discount?.toLocaleString() || 0}</td>
                  <td className="px-4 py-3 text-sm text-right">{line.tax?.toLocaleString() || 0}</td>
                  <td className="px-4 py-3 text-sm text-right font-bold">{line.total?.toLocaleString() || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} entries
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
