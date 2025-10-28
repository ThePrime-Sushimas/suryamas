'use client';

import { Branch } from '@/types/branch';
import SortIndicator from '@/components/ui/SortIndicator';
import Link from 'next/link';

interface BranchTableProps {
  branches: Branch[];
  sortConfig: {
    key: string;
    direction: 'asc' | 'desc';
  } | null;
  onSort: (key: string) => void;
}

export default function BranchTable({ branches, sortConfig, onSort }: BranchTableProps) {
  const formatTime = (time: string) => {
    return time.slice(0, 5); // Remove seconds
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID');
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('kode_branch')}
              >
                <div className="flex items-center space-x-1">
                  <span>Code</span>
                  <SortIndicator 
                    direction={sortConfig?.key === 'kode_branch' ? sortConfig?.direction : null}
                  />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Brand
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('nama_branch')}
              >
                <div className="flex items-center space-x-1">
                  <span>Branch Name</span>
                  <SortIndicator 
                    direction={sortConfig?.key === 'nama_branch' ? sortConfig?.direction : null}
                  />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Address
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => onSort('kota')}
              >
                <div className="flex items-center space-x-1">
                  <span>City</span>
                  <SortIndicator 
                    direction={sortConfig?.key === 'kota' ? sortConfig?.direction : null}
                  />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Operating Hours
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Operating Days
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Person In Charge
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Badan Hukum
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {branches.map((branch) => (
              <tr key={branch.id_branch} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {branch.kode_branch}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{branch.brand}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{branch.nama_branch}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 max-w-xs truncate" title={branch.alamat}>
                    {branch.alamat}
                  </div>
                  <div className="text-sm text-gray-500">{branch.provinsi}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {branch.kota}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatTime(branch.jam_buka)} - {formatTime(branch.jam_tutup)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {branch.hari_operasional}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {branch.pic?.full_name || branch.pic_id || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={branch.badan}>
                  {branch.badan || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    branch.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {branch.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <Link
                      href={`/master/branches/${branch.id_branch}`}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View
                    </Link>
                    <Link
                      href={`/master/branches/${branch.id_branch}/edit`}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Edit
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}