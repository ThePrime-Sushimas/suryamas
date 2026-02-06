import { useMemo, useState } from 'react'
import { Eye, FileText, AlertTriangle, XCircle, CheckCircle2, Copy } from 'lucide-react'

type PreviewTab = 'all' | 'valid' | 'duplicate' | 'invalid'

interface AnalysisPreviewProps {
  previewData: unknown[]
  duplicates?: unknown[]
  invalidRows?: unknown[]
  maxRows?: number
}

export function AnalysisPreview({ 
  previewData, 
  duplicates = [],
  invalidRows = [],
  maxRows = 10 
}: AnalysisPreviewProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>('all')

  // Combine all data with type markers
  const allData = useMemo(() => {
    const combined: Array<{ type: 'valid' | 'duplicate' | 'invalid'; data: unknown }> = []
    
    // Add valid rows
    if (Array.isArray(previewData)) {
      previewData.forEach(row => {
        combined.push({ type: 'valid', data: row })
      })
    }
    
    // Add duplicate rows
    if (Array.isArray(duplicates)) {
      duplicates.forEach(row => {
        combined.push({ type: 'duplicate', data: row })
      })
    }
    
    // Add invalid rows
    if (Array.isArray(invalidRows)) {
      invalidRows.forEach(row => {
        combined.push({ type: 'invalid', data: row })
      })
    }
    
    return combined
  }, [previewData, duplicates, invalidRows])

  // Filter data based on active tab
  const displayData = useMemo(() => {
    let filtered = allData
    if (activeTab !== 'all') {
      filtered = allData.filter(item => item.type === activeTab)
    }
    return filtered.slice(0, maxRows)
  }, [allData, activeTab, maxRows])

  const validCount = Array.isArray(previewData) ? previewData.length : 0
  const duplicateCount = Array.isArray(duplicates) ? duplicates.length : 0
  const invalidCount = Array.isArray(invalidRows) ? invalidRows.length : 0
  const totalCount = validCount + duplicateCount + invalidCount

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

  // Type for row data
  interface PreviewRowData {
    row_number?: number
    transaction_date?: string
    description?: string
    debit_amount?: number
    credit_amount?: number
    balance?: number
    is_valid?: boolean
    is_pending?: boolean
    errors?: string[]
    reference_number?: string
    existing_import_id?: number
    existing_statement_id?: number
    row_numbers?: number[]
  }

  // Type guard untuk preview row
  const isPreviewRow = (row: unknown): row is PreviewRowData => {
    return typeof row === 'object' && row !== null
  }

  // Helper to get description from row (handles different data structures)
  const getDescription = (row: PreviewRowData): string => {
    // For duplicates from backend, description might be empty or reference_number is used
    return row.description || row.reference_number || '-'
  }

  // Helper to get row number display
  const getRowNumber = (row: PreviewRowData, index: number): string => {
    // For duplicates, row_numbers might be an array
    if (row.row_numbers && Array.isArray(row.row_numbers) && row.row_numbers.length > 0) {
      return row.row_numbers.join(', ')
    }
    return String(row.row_number || index + 1)
  }

  const getStatusBadge = (type: 'valid' | 'duplicate' | 'invalid') => {
    switch (type) {
      case 'valid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            VALID
          </span>
        )
      case 'duplicate':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            <Copy className="w-3 h-3" />
            DUPLIKAT
          </span>
        )
      case 'invalid':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
            <XCircle className="w-3 h-3" />
            INVALID
          </span>
        )
    }
  }

  if (totalCount === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p>Tidak ada data preview tersedia</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-100 dark:border-gray-800 pb-3">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            activeTab === 'all'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}
        >
          Semua ({totalCount})
        </button>
        <button
          onClick={() => setActiveTab('valid')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            activeTab === 'valid'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
          }`}
        >
          <CheckCircle2 className="w-3 h-3 inline mr-1" />
          Valid ({validCount})
        </button>
        {duplicateCount > 0 && (
          <button
            onClick={() => setActiveTab('duplicate')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'duplicate'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            <Copy className="w-3 h-3 inline mr-1" />
            Duplikat ({duplicateCount})
          </button>
        )}
        {invalidCount > 0 && (
          <button
            onClick={() => setActiveTab('invalid')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'invalid'
                ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            <XCircle className="w-3 h-3 inline mr-1" />
            Invalid ({invalidCount})
          </button>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900 dark:text-gray-100">
          {activeTab === 'all' && 'Semua Data'}
          {activeTab === 'valid' && 'Data Valid'}
          {activeTab === 'duplicate' && 'Data Duplikat'}
          {activeTab === 'invalid' && 'Data Invalid'}
        </h4>
        <span className="text-xs text-gray-500">
          Menampilkan {displayData.length} dari {
            activeTab === 'all' ? totalCount :
            activeTab === 'valid' ? validCount :
            activeTab === 'duplicate' ? duplicateCount :
            invalidCount
          } baris
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
            {displayData.map((item, index) => {
              if (!isPreviewRow(item.data)) return null
              const row = item.data

              return (
                <tr 
                  key={index} 
                  className={`transition-colors ${
                    item.type === 'duplicate' ? 'bg-amber-50/50 dark:bg-amber-900/5' :
                    item.type === 'invalid' ? 'bg-rose-50/50 dark:bg-rose-900/5' :
                    'hover:bg-blue-50/30 dark:hover:bg-blue-900/10'
                  }`}
                >
                  <td className="py-3 px-4 text-sm text-gray-500">
                    {getRowNumber(row, index)}
                  </td>
                  <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                    {row.transaction_date || '-'}
                  </td>
                  <td 
                    className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 max-w-[200px] truncate"
                    title={getDescription(row)}
                  >
                    {truncateText(getDescription(row), 35)}
                  </td>
                  <td className="py-3 px-4 text-sm text-right font-medium text-rose-600">
                    {row.debit_amount ? formatCurrency(row.debit_amount) : '-'}
                  </td>
                  <td className="py-3 px-4 text-sm text-right font-medium text-emerald-600">
                    {row.credit_amount ? formatCurrency(row.credit_amount) : '-'}
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(item.type)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {displayData.length >= maxRows && (
        <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
          <Eye className="w-4 h-4" />
          <span>
            Menampilkan {maxRows} dari {
              activeTab === 'all' ? totalCount :
              activeTab === 'valid' ? validCount :
              activeTab === 'duplicate' ? duplicateCount :
              invalidCount
            } data
          </span>
        </div>
      )}

      {/* Info Box for Duplicates */}
      {duplicateCount > 0 && activeTab === 'duplicate' && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-xs text-amber-800 dark:text-amber-300">
            <p className="font-medium mb-1">Data duplikat terdeteksi</p>
            <p>Baris-baris ini sudah ada di database atau duplikat dalam file yang sama. Centang "Lewati Data Duplikat" untuk tidak mengimport baris ini.</p>
          </div>
        </div>
      )}

      {/* Info Box for Invalid */}
      {invalidCount > 0 && activeTab === 'invalid' && (
        <div className="bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800 rounded-lg p-3 flex items-start gap-2">
          <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
          <div className="text-xs text-rose-800 dark:text-rose-300">
            <p className="font-medium mb-1">Data invalid</p>
            <p>Baris-baris ini tidak dapat diproses karena format tidak valid atau data tidak lengkap.</p>
          </div>
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
