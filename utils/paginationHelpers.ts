export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  showingFrom: number;
  showingTo: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function calculatePaginationMeta(
  currentPage: number,
  totalItems: number,
  itemsPerPage: number
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const showingFrom = (currentPage - 1) * itemsPerPage + 1;
  const showingTo = Math.min(currentPage * itemsPerPage, totalItems);

  return {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    showingFrom,
    showingTo,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1
  };
}

export function getVisiblePageNumbers(
  currentPage: number,
  totalPages: number,
  maxVisible: number = 5
): number[] {
  const pages: number[] = [];
  
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return pages;
}

export function paginateArray<T>(
  array: T[],
  currentPage: number,
  itemsPerPage: number
): T[] {
  const startIndex = (currentPage - 1) * itemsPerPage;
  return array.slice(startIndex, startIndex + itemsPerPage);
}