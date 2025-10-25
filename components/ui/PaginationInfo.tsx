interface PaginationInfoProps {
  showingFrom: number;
  showingTo: number;
  totalItems: number;
  className?: string;
}

export default function PaginationInfo({ 
  showingFrom, 
  showingTo, 
  totalItems, 
  className = '' 
}: PaginationInfoProps) {
  return (
    <div className={`text-sm text-gray-600 ${className}`}>
      Showing {showingFrom} to {showingTo} of {totalItems} entries
    </div>
  );
}