interface BulkAction {
  label: string
  onClick: () => void
  className?: string
  disabled?: boolean
}

interface BulkActionBarProps {
  selectedCount: number
  actions: BulkAction[]
}

export default function BulkActionBar({ selectedCount, actions }: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <>
      <span className="px-3 py-2 bg-gray-100 rounded text-sm">
        {selectedCount} selected
      </span>
      {actions.map((action, idx) => (
        <button
          key={idx}
          onClick={action.onClick}
          disabled={action.disabled}
          className={action.className || 'px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700'}
        >
          {action.label}
        </button>
      ))}
    </>
  )
}
