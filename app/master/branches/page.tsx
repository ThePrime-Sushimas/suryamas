'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BranchTable from '@/components/master/branches/BranchTable';
import Pagination from '@/components/ui/Pagination';
import PaginationInfo from '@/components/ui/PaginationInfo';
import SortButton from '@/components/ui/SortButton';
import Link from 'next/link';
import { Branch } from '@/types/branch';


interface ApiResponse {
  branches: Branch[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
  };
}

function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function BranchesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [data, setData] = useState<ApiResponse>({
    branches: [],
    pagination: {
      current_page: 1,
      total_pages: 0,
      total_count: 0
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [selectedKota, setSelectedKota] = useState(searchParams.get('kota') || '');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || '');
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get('page')) || 1);
  const [itemsPerPage, setItemsPerPage] = useState(Number(searchParams.get('limit')) || 10);

  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>({
    key: searchParams.get('sort_by') || 'created_at',
    direction: (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc'
  });

  const debouncedSearchTerm = useDebounce(searchTerm, 200);

  const updateURL = (params: Record<string, string | number | null>) => {
    const url = new URLSearchParams(searchParams.toString());
    
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.set(key, value.toString());
      } else {
        url.delete(key);
      }
    });
    
    router.push(`?${url.toString()}`, { scroll: false });
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      if (debouncedSearchTerm) {
        params.append('search', debouncedSearchTerm);
      }
      if (selectedKota) {
        params.append('kota', selectedKota);
      }
      if (selectedStatus) {
        params.append('status', selectedStatus);
      }
      if (sortConfig) {
        params.append('sort_by', sortConfig.key);
        params.append('sort_order', sortConfig.direction);
      }

      const response = await fetch(`/api/branches?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data');
      }

      const result = await response.json();
      setData(result);
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentPage, itemsPerPage, debouncedSearchTerm, selectedKota, selectedStatus, sortConfig]);

  useEffect(() => {
    updateURL({
      page: currentPage,
      limit: itemsPerPage,
      search: debouncedSearchTerm || null,
      kota: selectedKota || null,
      status: selectedStatus || null,
      sort_by: sortConfig?.key || null,
      sort_order: sortConfig?.direction || null
    });
  }, [currentPage, itemsPerPage, debouncedSearchTerm, selectedKota, selectedStatus, sortConfig]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedKota, selectedStatus, sortConfig]);

  const handleSort = (key: string) => {
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

  const clearSort = () => {
    setSortConfig(null);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedKota('');
    setSelectedStatus('');
    setSortConfig({ key: 'created_at', direction: 'desc' });
    setCurrentPage(1);
  };

  const kotas = [...new Set(data.branches.map(b => b.kota).filter(Boolean))];
  const isFilterActive = debouncedSearchTerm || selectedKota || selectedStatus;

  if (loading && data.branches.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse bg-white rounded-lg p-8">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Branches</h1>
              <p className="text-gray-600 mt-2">
                Manage your restaurant branches
              </p>
            </div>
            <Link
              href="/master/branches/create"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Branch
            </Link>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <input
              type="text"
              placeholder="Search by name, code, or address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />            
          </div>

          {/* Sort Controls */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-gray-700">Sort by:</span>
            
            <SortButton
              sortKey="nama_branch"
              currentSort={sortConfig}
              onSort={handleSort}
              className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
            >
              Name
            </SortButton>
            
            <SortButton
              sortKey="kota"
              currentSort={sortConfig}
              onSort={handleSort}
              className="text-sm px-3 py-1 border border-gray-300 rounded hover:bg-gray-50"
            >
              City
            </SortButton>          

            {sortConfig && (
              <button
                onClick={clearSort}
                className="text-sm px-3 py-1 text-red-600 hover:text-red-800 underline"
              >
                Clear Sort
              </button>
            )}
          </div>

          {sortConfig && (
            <div className="mt-2 text-sm text-blue-600">
              Sorted by: <span className="font-semibold capitalize">
                {sortConfig.key.replace('_', ' ')}
              </span> ({sortConfig.direction === 'asc' ? 'Ascending' : 'Descending'})
            </div>
          )}
        </div>

        {/* Branch Table */}
        <BranchTable 
          branches={data.branches} 
          sortConfig={sortConfig}
          onSort={handleSort}
        />

        {/* Pagination */}
        {(data.pagination.total_count > 0 || isFilterActive) && (
          <div className="mt-6 space-y-4">
            <PaginationInfo
              showingFrom={data.pagination.total_count === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1}
              showingTo={Math.min(currentPage * itemsPerPage, data.pagination.total_count)}
              totalItems={data.pagination.total_count}
            />

            <Pagination
              currentPage={currentPage}
              totalPages={data.pagination.total_pages}
              onPageChange={setCurrentPage}
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={(newSize) => {
                setItemsPerPage(newSize);
                setCurrentPage(1);
              }}
            />
          </div>
        )}

        {/* Empty State */}
        {data.pagination.total_count === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg font-medium">
              {isFilterActive 
                ? 'No branches match your criteria' 
                : 'No branches found'
              }
            </p>
            {isFilterActive && (
              <button
                onClick={clearAllFilters}
                className="mt-2 text-blue-600 hover:text-blue-800 underline"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}