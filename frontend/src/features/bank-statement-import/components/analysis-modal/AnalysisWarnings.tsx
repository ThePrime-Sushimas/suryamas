import { AlertTriangle, Info, XCircle, ChevronRight } from 'lucide-react'

interface AnalysisWarningsProps {
  warnings?: string[]
  duplicateCount?: number
  oldDataCount?: number
  futureDateCount?: number
}

export function AnalysisWarnings({
  warnings = [],
  duplicateCount = 0,
  oldDataCount = 0,
  futureDateCount = 0,
}: AnalysisWarningsProps) {
  const hasWarnings = warnings.length > 0 || duplicateCount > 0 || oldDataCount > 0 || futureDateCount > 0

  if (!hasWarnings) return null

  return (
    <div className="space-y-3">
      {/* Duplicates Warning */}
      {duplicateCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-amber-800 dark:text-amber-300">
                {duplicateCount} Transaksi Duplikat Ditemukan
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                Transaksi ini akan dilewati jika opsi "Lewati duplikat" dipilih saat import.
              </p>
              <div className="flex items-center gap-1 mt-2 text-xs text-amber-600 dark:text-amber-500">
                <ChevronRight className="w-3 h-3" />
                <span>Cek di tab "Preview Data" untuk detail</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Future Dates Warning */}
      {futureDateCount > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg shrink-0">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-blue-800 dark:text-blue-300">
                {futureDateCount} Tanggal di Masa Depan
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                Beberapa transaksi memiliki tanggal di masa depan yang mungkin perlu dicek kembali.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Old Data Warning */}
      {oldDataCount > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg shrink-0">
              <Info className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-gray-800 dark:text-gray-300">
                {oldDataCount} Data Lama
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Beberapa transaksi lebih dari 1 tahun yang mungkin perlu dicek kembali.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Custom Warnings */}
      {warnings.map((warning, idx) => (
        <div 
          key={idx}
          className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-orange-800 dark:text-orange-300">Peringatan</p>
              <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">{warning}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// Compact warnings for inline display
export function AnalysisWarningsCompact({
  warnings = [],
  duplicateCount = 0,
}: {
  warnings?: string[]
  duplicateCount?: number
}) {
  const totalIssues = warnings.length + (duplicateCount > 0 ? 1 : 0)
  
  if (totalIssues === 0) return null

  return (
    <div className="flex items-center gap-2 text-sm">
      {duplicateCount > 0 && (
        <span className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
          <AlertTriangle className="w-3.5 h-3.5" />
          {duplicateCount} duplikat
        </span>
      )}
      {warnings.length > 0 && (
        <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-full">
          <XCircle className="w-3.5 h-3.5" />
          {warnings.length} peringatan
        </span>
      )}
    </div>
  )
}

