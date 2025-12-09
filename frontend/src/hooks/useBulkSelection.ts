import { useState } from 'react'

export function useBulkSelection<T extends { id: string }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const selectAll = (checked: boolean) => {
    setSelectedIds(checked ? items.map(item => item.id) : [])
  }

  const selectOne = (id: string, checked: boolean) => {
    setSelectedIds(checked ? [...selectedIds, id] : selectedIds.filter(i => i !== id))
  }

  const clearSelection = () => {
    setSelectedIds([])
  }

  const isSelected = (id: string) => selectedIds.includes(id)
  const isAllSelected = selectedIds.length === items.length && items.length > 0

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
