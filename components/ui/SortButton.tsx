interface SortButtonProps {
  children: React.ReactNode;
  sortKey: string;
  currentSort?: { key: string; direction: 'asc' | 'desc' } | null;
  onSort: (key: string) => void;
  className?: string;
}

export default function SortButton({ 
  children, 
  sortKey, 
  currentSort, 
  onSort, 
  className = '' 
}: SortButtonProps) {
  const isActive = currentSort?.key === sortKey;
  const direction = isActive ? currentSort.direction : null;

  return (
    <button
      onClick={() => onSort(sortKey)}
      className={`flex items-center gap-1 hover:bg-gray-50 p-1 rounded ${className}`}
    >
      {children}
      <span className="text-xs">
        {isActive ? (direction === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  );
}