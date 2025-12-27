import { AlertTriangle } from 'lucide-react'

interface PrimaryBranchModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  employeeName: string
  targetBranchName: string
  isLoading: boolean
}

export function PrimaryBranchModal({
  isOpen,
  onClose,
  onConfirm,
  employeeName,
  targetBranchName,
  isLoading
}: PrimaryBranchModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Ganti Primary Branch
              </h3>
              
              <div className="space-y-3 text-sm text-gray-600 mb-4">
                <p>
                  <span className="font-medium">{employeeName}</span> sudah memiliki primary branch.
                </p>
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3">
                  <p className="font-medium text-yellow-800">Set primary branch baru akan:</p>
                  <ul className="mt-1 list-disc list-inside text-yellow-700 space-y-1">
                    <li>Menghapus status primary dari branch saat ini</li>
                    <li>Set <span className="font-medium">{targetBranchName}</span> sebagai primary baru</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Memproses...
                </>
              ) : (
                'Ganti Primary Branch'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
