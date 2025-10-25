import { useSort } from './useSort';
import { usePagination } from './usePagination';

export function useTableData<T>(
  data: T[],
  options?: {
    defaultSort?: { key: keyof T; direction: 'asc' | 'desc' };
    itemsPerPage?: number;
  }
) {
  const { sortedData, sortConfig, handleSort, clearSort } = useSort(data, options?.defaultSort);
  const { 
    paginatedData, 
    currentPage, 
    totalPages, 
    setCurrentPage,
    totalItems,
    itemsPerPage,
    setItemsPerPage
  } = usePagination(sortedData, options?.itemsPerPage);

  return {
    // Data
    data: paginatedData,
    sortedData,
    originalData: data,
    
    // Sort
    sortConfig,
    handleSort,
    clearSort,
    
    // Pagination
    currentPage,
    totalPages,
    setCurrentPage,
    totalItems,
    itemsPerPage,
    setItemsPerPage,
    
    // Metadata
    showingFrom: (currentPage - 1) * itemsPerPage + 1,
    showingTo: Math.min(currentPage * itemsPerPage, totalItems)
  };
}