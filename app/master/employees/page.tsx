'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabaseClient';
import EmployeeTable from '@/components/master/employees/EmployeeTable';
import Pagination from '@/components/ui/Pagination';
import PaginationInfo from '@/components/ui/PaginationInfo';
import Link from 'next/link';

interface Employee {
  employee_id: string;
  full_name: string;
  job_position: string;
  branch_name: string;
  status_employee: string;
  email: string;
  join_date: string;
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch employees dengan database-level pagination
  const fetchEmployees = async () => {
    try {
      setLoading(true);
      
      // Calculate range untuk Supabase
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;

      // Build query dengan filters
      let query = supabase
        .from('employees')
        .select('*', { count: 'exact' }); // Get total count

      // Apply search filter - AKAN PAKAI INDEX jika ada
      if (searchTerm) {
        query = query.or(`full_name.ilike.%${searchTerm}%,employee_id.ilike.%${searchTerm}%,job_position.ilike.%${searchTerm}%`);
      }

      // Apply branch filter - AKAN PAKAI INDEX idx_employees_branch
      if (selectedBranch) {
        query = query.eq('branch_name', selectedBranch);
      }

      // Apply status filter - AKAN PAKAI INDEX idx_employees_status  
      if (selectedStatus) {
        query = query.eq('status_employee', selectedStatus);
      }

      // Execute query dengan sorting - AKAN PAKAI INDEX idx_employees_join_date
      const { data, error, count } = await query
        .order('join_date', { ascending: false })
        .range(from, to);

      if (error) throw error;

      setEmployees(data || []);
      setTotalCount(count || 0);
      
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data ketika filters/pagination berubah
  useEffect(() => {
    fetchEmployees();
  }, [currentPage, itemsPerPage, searchTerm, selectedBranch, selectedStatus]);

  // Reset ke page 1 ketika search/filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranch, selectedStatus]);

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  // Get unique values untuk dropdown filters
  const branches = [...new Set(employees.map(e => e.branch_name).filter(Boolean))];
  const statuses = [...new Set(employees.map(e => e.status_employee))];

  if (loading && employees.length === 0) {
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

        {/* Stats - Real count dari database */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-2xl font-bold text-gray-900">{totalCount}</div>
            <div className="text-gray-600">Total Employees</div>
          </div>
          {/* Stats lainnya bisa di-fetch terpisah jika needed */}
        </div>

        {/* Search & Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              placeholder="Search by name, ID, or position..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            
            {/* Branch Filter - AKAN PAKAI INDEX */}
            <select 
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Branches</option>
              {branches.map(branch => (
                <option key={branch} value={branch}>{branch}</option>
              ))}
            </select>
            
            {/* Status Filter - AKAN PAKAI INDEX */}
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
        </div>

        {/* Employee Table - HANYA data yang ditampilkan */}
        <EmployeeTable employees={employees} />

        {/* Pagination Section - SANGAT KEPAKE! */}
        {(totalCount > 0 || searchTerm || selectedBranch || selectedStatus) && (
          <div className="mt-6 space-y-4">
            {/* Pagination Info */}
            <PaginationInfo
              showingFrom={totalCount === 0 ? 0 : ((currentPage - 1) * itemsPerPage) + 1}
              showingTo={Math.min(currentPage * itemsPerPage, totalCount)}
              totalItems={totalCount}
            />

            {/* Pagination Controls */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
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
        {totalCount === 0 && !loading && (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <p className="text-gray-500 text-lg font-medium">
              {searchTerm || selectedBranch || selectedStatus 
                ? 'No employees match your criteria' 
                : 'No employees found'
              }
            </p>
            {(searchTerm || selectedBranch || selectedStatus) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedBranch('');
                  setSelectedStatus('');
                }}
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