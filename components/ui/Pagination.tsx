interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage?: number;
  onItemsPerPageChange?: (items: number) => void;
}

export default function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange 
}: PaginationProps) {
  const pageNumbers = [];
  const maxVisiblePages = 5;
  
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
      {/* Items per page selector */}
      {itemsPerPage && onItemsPerPageChange && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Show</span>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="border rounded px-2 py-1 text-sm"
          >
            {[10, 20, 50, 100].map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span className="text-sm text-gray-600">entries</span>
        </div>
      )}

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
        >
          «
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
        >
          ‹
        </button>

        {pageNumbers.map(page => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`px-3 py-1 border rounded ${
              currentPage === page 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'hover:bg-gray-50'
            }`}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
        >
          ›
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 border rounded disabled:opacity-50 hover:bg-gray-50"
        >
          »
        </button>
      </div>
    </div>
  );
}