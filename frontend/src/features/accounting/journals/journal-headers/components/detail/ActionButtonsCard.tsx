import { Send, CheckCircle, XCircle, RotateCcw, Banknote, Loader2 } from 'lucide-react'

interface ActionButtonsCardProps {
  canSubmit: boolean
  canApprove: boolean
  canReject: boolean
  canPost: boolean
  canReverse: boolean
  mutating: boolean
  handleSubmit: () => Promise<void>
  handleApprove: () => Promise<void>
  handlePost: () => Promise<void>
  setShowRejectModal: (show: boolean) => void
  setShowReverseModal: (show: boolean) => void
}

export function ActionButtonsCard({
  canSubmit,
  canApprove,
  canReject,
  canPost,
  canReverse,
  mutating,
  handleSubmit,
  handleApprove,
  handlePost,
  setShowRejectModal,
  setShowReverseModal,
}: ActionButtonsCardProps) {
  const hasActions = canSubmit || canApprove || canReject || canPost || canReverse
  
  if (!hasActions) return null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <h3 className="font-semibold text-gray-900 dark:text-white">Aksi</h3>
      </div>
      <div className="p-4 space-y-3">
        {/* Primary actions first */}
        {canSubmit && (
          <button
            onClick={handleSubmit}
            disabled={mutating}
            className="w-full flex items-center gap-3 px-4 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {mutating ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            <span className="font-medium">Kirim untuk Persetujuan</span>
          </button>
        )}
        {canApprove && (
          <button
            onClick={handleApprove}
            disabled={mutating}
            className="w-full flex items-center gap-3 px-4 py-3 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {mutating ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
            <span className="font-medium">Setujui</span>
          </button>
        )}
        {canPost && (
          <button
            onClick={handlePost}
            disabled={mutating}
            className="w-full flex items-center gap-3 px-4 py-3 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Banknote size={18} />
            <span className="font-medium">Posting ke GL</span>
          </button>
        )}
        {canReverse && (
          <button
            onClick={() => setShowReverseModal(true)}
            disabled={mutating}
            className="w-full flex items-center gap-3 px-4 py-3 bg-orange-600 dark:bg-orange-500 text-white rounded-lg hover:bg-orange-700 dark:hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw size={18} />
            <span className="font-medium">Balikkan Jurnal</span>
          </button>
        )}

        {/* Destructive/secondary action last with outline style */}
        {canReject && (
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={mutating}
            className="w-full flex items-center gap-3 px-4 py-3 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <XCircle size={18} />
            <span className="font-medium">Tolak</span>
          </button>
        )}
      </div>
    </div>
  )
}
