import { useState, useMemo } from 'react';

export interface SortConfig<T> {
  key: keyof T;
  direction: 'asc' | 'desc';
}

export function useSort<T>(
  data: T[], 
  defaultSort?: SortConfig<T>
) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(defaultSort || null);

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;
    
    return [...data].sort((a, b) => {
      let aValue: any = a[sortConfig.key];
      let bValue: any = b[sortConfig.key];

      // Handle different data types
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue instanceof Date && bValue instanceof Date) {
        aValue = aValue.getTime();
        bValue = bValue.getTime();
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  const handleSort = (key: keyof T) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      return { key, direction: 'asc' };
    });
  };

  const clearSort = () => setSortConfig(null);

  return { 
    sortedData, 
    sortConfig, 
    handleSort, 
    clearSort 
  };
}