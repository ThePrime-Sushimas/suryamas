import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Eye } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

export default function PRApprovalListPage() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-requests', 'pending-approval'],
    queryFn: async () => {
      const { data } = await api.get('/purchase-requests', { params: { status: 'PENDING_APPROVAL', limit: 50 } })
      return data.data
    },
  })

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-green-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">PR Approval</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Purchase Request yang menunggu persetujuan</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />)}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheck className="w-12 h-12 text-green-300 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Tidak ada PR yang menunggu approval</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. PR</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cabang</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Dibutuhkan</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estimasi</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Dibuat oleh</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {data.map((pr: Record<string, unknown>) => (
                  <tr key={pr.id as string} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{pr.request_number as string}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{pr.branch_name as string}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{fmtDate(pr.request_date as string)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{pr.needed_by_date ? fmtDate(pr.needed_by_date as string) : '—'}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">{(pr.total_pricelist as number) > 0 ? `Rp ${fmt(pr.total_pricelist as number)}` : (pr.total_estimated as number) > 0 ? `Rp ${fmt(pr.total_estimated as number)}` : '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{(pr.requested_by_name as string) || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => navigate(`/inventory/purchase-requests/${pr.id}/approve`)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-medium">
                        <Eye className="w-3.5 h-3.5" /> Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
