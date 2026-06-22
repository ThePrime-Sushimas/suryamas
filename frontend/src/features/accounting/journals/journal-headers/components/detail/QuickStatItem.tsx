interface QuickStatItemProps {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
}

export function QuickStatItem({ icon, label, value }: QuickStatItemProps) {
  return (
    <div className="flex items-start gap-2">
      <div className="text-gray-400 dark:text-gray-500 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
        <div className="text-sm text-gray-900 dark:text-white mt-0.5">{value}</div>
      </div>
    </div>
  )
}
