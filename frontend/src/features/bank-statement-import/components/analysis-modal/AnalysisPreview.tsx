import { useMemo } from 'react'
import { Eye, FileText } from 'lucide-react'

interface AnalysisPreviewProps {
  previewData: unknown[]
  validRows: number
  maxRows?: number
}

export function AnalysisPreview({ previewData, validRows, maxRows = 10 }: AnalysisPreviewProps) {
  const displayData = useMemo(() => {
    if (!Array.isArray(previewData)) return []
    return previewData.slice(0, maxRows)
  }, [previewData, maxRows])

  const truncateText = (text: string, maxLength: number = 35): string => {
    if (!text) return '-'
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  const formatCurrency = (value: number): string => {
    if (value === undefined || value === null) return '-'
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  // Type guard untuk preview row
  const isPreviewRow = (row: unknown): row is {
    row_number?: number
    transaction_date?: string
    description?: string
    debit_amount?: number
    credit_amount?: number
    balance?: number
    is_valid?: boolean
    is_pending?: boolean
  } => {
    return typeof row === 'object' && row !== null
  }

  if (!Array.isArray(previewData) || previewData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Tidak ada data preview tersedia</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900 dark:text-gray-100">
          Sample Data
        </h4>
        <span className="text-xs text-gray-500">
          Menampilkan {displayData.length} dari {validRows.toLocaleString()} transaksi
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <table className="table table-sm w-full">
          <thead className="bg-gray-50/50 dark:bg-gray-800/50">
            <tr>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">No</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tanggal</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Deskripsi</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Debit</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Credit</th>
              <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {displayData.map((row, index) => {
              if (!isPreviewRow(row)) return null

              return (
                <tr key={index} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors">
                  <td className="py-3 px-4 text-sm text-gray-500">
                    {row.row_number || index + 1}
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {row.transaction_date || '-'}
                  </td>
                  <td 
                    className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 max-w-[200px] truncate"
                    title={row.description}
                  >
                    {truncateText(row.description || '', 35)}
                  </td>
                  <td className="py-3 px-4 text-sm text-right font-medium text-rose-600">
                    {row.debit_amount ? formatCurrency(row.debit_amount) : '-'}
                  </td>
                  <td className="py-3 px-4 text-sm text-right font-medium text-emerald-600">
                    {row.credit_amount ? formatCurrency(row.credit_amount) : '-'}
                  </td>
                  <td className="py-3 px-4">
                    {row.is_pending ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                        PENDING
                      </span>
                    ) : row.is_valid !== false ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                        VALID
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
                        INVALID
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {validRows > maxRows && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <Eye className="w-4 h-4" />
          <span>Menampilkan {maxRows} dari {validRows.toLocaleString()} data</span>
        </div>
      )}
    </div>
  )
}

// Compact preview card
export function AnalysisPreviewCard({ previewData }: { previewData: unknown[] }) {
  const displayData = useMemo(() => {
    if (!Array.isArray(previewData)) return []
    return previewData.slice(0, 3)
  }, [previewData])

  if (!Array.isArray(previewData) || previewData.length === 0) {
    return null
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
      <p className="text-xs font-medium text-gray-500 mb-2">Preview</p>
      <div className="space-y-2">
        {displayData.map((row, idx) => {
          const rowData = row as Record<string, unknown>
          return (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400 truncate max-w-[150px]">
                {(rowData.description as string) || '-'}
              </span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {rowData.credit_amount ? `+${rowData.credit_amount}` : rowData.debit_amount ? `-${rowData.debit_amount}` : '-'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

