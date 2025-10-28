'use client';

import { useState, useEffect } from 'react';
import EmployeeTable from '@/components/master/employees/EmployeeTable';
import Pagination from '@/components/ui/Pagination';
import PaginationInfo from '@/components/ui/PaginationInfo';
import Link from 'next/link';
import { EmployeeStatus } from '@/types/employee';

interface Employee {
  employee_id: string;
  full_name: string;
  job_position: string;
  branch_name: string;
  status_employee: EmployeeStatus;
  email: string;
  join_date: string;
}

interface ApiResponse {
  employees: Employee[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
  };
}

// Custom hook untuk debounce
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

export default function EmployeesPage() {
  const [data, setData] = useState<ApiResponse>({
    employees: [],
    pagination: {
      current_page: 1,
      total_pages: 0,
      total_count: 0
    }
  });
  
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Sorting state
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>({ key: 'join_date', direction: 'desc' });

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 200);

  // Fetch data dari API
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      });

      // Tambahkan filters jika ada
      if (debouncedSearchTerm) {
        params.append('search', debouncedSearchTerm);
      }
      if (selectedBranch) {
        params.append('branch', selectedBranch);
      }
      if (selectedStatus) {
        params.append('status', selectedStatus);
      }
      if (sortConfig) {
        params.append('sort_by', sortConfig.key);
        params.append('sort_order', sortConfig.direction);
      }

      const response = await fetch(`/api/employees?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch data');
      }

      const result = await response.json();
      setData(result);
      
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data ketika parameters berubah
  useEffect(() => {
    fetchData();
  }, [currentPage, itemsPerPage, debouncedSearchTerm, selectedBranch, selectedStatus, sortConfig]);

  // Reset ke page 1 ketika search/filter/sort berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, selectedBranch, selectedStatus, sortConfig]);

  // Handle sort
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

  // Clear sort
  const clearSort = () => {
    setSortConfig(null);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedBranch('');
    setSelectedStatus('');
    setSortConfig({ key: 'join_date', direction: 'desc' });
    setCurrentPage(1);
  };

  // Get unique values untuk dropdown filters (dari data yang sudah ada)
  const branches = [...new Set(data.employees.map(e => e.branch_name).filter(Boolean))];
  const statuses = [...new Set(data.employees.map(e => e.status_employee))];

  // Check if any filter is active
  const isFilterActive = debouncedSearchTerm || selectedBranch || selectedStatus;

  if (loading && data.employees.length === 0) {
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
              <h1 className="text-3xl font-bold text-gray-900">Employees</h1>
              <p className="text-gray-600 mt-2">
                Manage your restaurant employees
              </p>
            </div>
            <Link
              href="/master/employees/create"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Employee
            </Link>
          </div>
        </div>

        {/* Search, Filters & Sort Controls */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <input
              type="text"
              placeholder="Search by name, ID, or position..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />        
            <select 
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Status</option>
              {statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          
        {/* Branch Filter Buttons */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-gray-700">Filter by Branch:</span>
          
        {/* All Branches */}
        <button
          onClick={() => setSelectedBranch('')}
          className={`text-sm px-3 py-1 border rounded transition-colors ${
            selectedBranch === '' 
              ? 'bg-blue-600 text-white border-blue-600' 
              : 'border-gray-300 hover:bg-gray-50'
          }`}
        >
          All Branches
        </button>          
          {branches.map(branch => (
            <button
              key={branch}
              onClick={() => setSelectedBranch(branch)}
              className={`text-sm px-3 py-1 border rounded transition-colors ${
                selectedBranch === branch 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {branch}
            </button>
          ))}
        </div>
        </div>

        {/* Employee Table */}
        <EmployeeTable 
          employees={data.employees} 
          sortConfig={sortConfig}
          onSort={handleSort}
        />

        {/* Pagination Section */}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg font-medium">
              {isFilterActive 
                ? 'No employees match your criteria' 
                : 'No employees found'
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