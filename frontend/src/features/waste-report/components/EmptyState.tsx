import { Trash2 } from 'lucide-react'

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/30">
      <Trash2 className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" />
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">{message}</p>
    </div>
  )
}
