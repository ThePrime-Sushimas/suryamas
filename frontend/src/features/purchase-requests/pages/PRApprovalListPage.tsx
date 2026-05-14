import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import { PR_STATUS_CONFIG, PR_PRIORITY_CONFIG } from '../constants'

const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })

const TABS = [
  { key: 'PENDING_APPROVAL', label: 'Pending' },
  { key: 'CONVERTED', label: 'Converted' },
  { key: 'REJECTED', label: 'Rejected' },
]

export default function PRApprovalListPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('PENDING_APPROVAL')

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-requests', 'approval-list', activeTab],
    queryFn: async () => {
      const { data } = await api.get('/purchase-requests', { params: { status: activeTab, limit: 50 } })
      return data.data
    },
  })

  const handleRowClick = (pr: Record<string, unknown>) => {
    navigate(`/inventory/purchase-requests/${pr.id}/approve`)
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-indigo-600" />
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">PR Approval</h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Review, approve, atau reject Purchase Request</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6">
        <div className="flex gap-1">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />)}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {activeTab === 'PENDING_APPROVAL' ? 'Tidak ada PR yang menunggu approval' :
               activeTab === 'CONVERTED' ? 'Belum ada PR yang di-convert' :
               'Belum ada PR yang ditolak'}
            </p>
          </div>
        ) : (
          <>
            {/* Mobile: Cards */}
            <div className="sm:hidden space-y-3">
              {data.map((pr: Record<string, unknown>) => {
                const status = PR_STATUS_CONFIG[pr.status as string] ?? PR_STATUS_CONFIG.PENDING_APPROVAL
                const priority = PR_PRIORITY_CONFIG[pr.priority as string] ?? PR_PRIORITY_CONFIG.normal
                return (
                  <div key={pr.id as string} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer"
                    onClick={() => handleRowClick(pr)}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{pr.request_number as string}</p>
                        <p className="text-xs text-gray-500">{pr.branch_name as string}</p>
                      </div>
                      <div className="flex gap-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${priority.color}`}>{priority.label}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Tanggal</span>
                        <p className="text-gray-900 dark:text-gray-200">{fmtDate(pr.request_date as string)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Dibutuhkan</span>
                        <p className="text-gray-900 dark:text-gray-200">{pr.needed_by_date ? fmtDate(pr.needed_by_date as string) : '—'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Estimasi</span>
                        <p className="font-mono text-gray-900 dark:text-gray-200">
                          {(pr.total_pricelist as number) > 0 ? `Rp ${fmt(pr.total_pricelist as number)}` : '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Dibuat oleh</span>
                        <p className="text-gray-900 dark:text-gray-200">{(pr.requested_by_name as string) || '—'}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Desktop: Table */}
            <div className="hidden sm:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No. PR</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cabang</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tanggal</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Prioritas</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Estimasi</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Dibuat oleh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                    {data.map((pr: Record<string, unknown>) => {
                      const status = PR_STATUS_CONFIG[pr.status as string] ?? PR_STATUS_CONFIG.PENDING_APPROVAL
                      const priority = PR_PRIORITY_CONFIG[pr.priority as string] ?? PR_PRIORITY_CONFIG.normal
                      return (
                        <tr key={pr.id as string} onClick={() => handleRowClick(pr)}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{pr.request_number as string}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{pr.branch_name as string}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{fmtDate(pr.request_date as string)}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${priority.color}`}>{priority.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${status.color}`}>{status.label}</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">
                            {(pr.total_pricelist as number) > 0 ? `Rp ${fmt(pr.total_pricelist as number)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{(pr.requested_by_name as string) || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
