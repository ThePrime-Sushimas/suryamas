import { Lock } from 'lucide-react'

interface SystemLockBadgeProps {
  isSystem: boolean
  className?: string
}

export const SystemLockBadge = ({ isSystem, className = '' }: SystemLockBadgeProps) => {
  if (!isSystem) return null
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 ${className}`}>
      <Lock size={12} />
      System
    </span>
  )
}
