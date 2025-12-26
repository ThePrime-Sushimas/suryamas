import { useEffect, useState } from 'react'

export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    setSelectedIds(prev =>
      prev.filter(id => items.some(item => item.id === id))
    )
  }, [items])

  const selectAll = (checked: boolean) => {
    setSelectedIds(checked ? items.map(item => item.id) : [])
  }

  const selectOne = (id: string, checked: boolean) => {
    setSelectedIds(prev =>
      checked ? [...new Set([...prev, id])] : prev.filter(i => i !== id)
    )
  }

  const clearSelection = () => {
    setSelectedIds([])
  }

  const isSelected = (id: string) => selectedIds.includes(id)
  const isAllSelected = items.length > 0 && selectedIds.length === items.length

  return {
    selectedIds,
    selectAll,
    selectOne,
    clearSelection,
    isSelected,
    isAllSelected,
    selectedCount: selectedIds.length,
  }
}
