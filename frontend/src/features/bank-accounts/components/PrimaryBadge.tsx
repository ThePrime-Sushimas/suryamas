import { Star } from 'lucide-react'

interface PrimaryBadgeProps {
  isPrimary: boolean
}

export const PrimaryBadge = ({ isPrimary }: PrimaryBadgeProps) => {
  if (!isPrimary) return null

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
      <Star className="h-3 w-3 fill-yellow-600" />
      Primary
    </span>
  )
}
