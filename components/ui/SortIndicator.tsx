interface SortIndicatorProps {
  direction?: 'asc' | 'desc' | null;
  className?: string;
}

export default function SortIndicator({ direction, className = '' }: SortIndicatorProps) {
  if (!direction) return null;

  return (
    <span className={`ml-1 text-xs ${className}`}>
      {direction === 'asc' ? '↑' : '↓'}
    </span>
  );
}