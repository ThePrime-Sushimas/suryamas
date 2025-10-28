'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Branch } from '@/types/branch';

export default function BranchDetailPage() {
  const params = useParams();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      fetchBranch();
    }
  }, [params.id]);

  const fetchBranch = async () => {
    try {
      console.log('Fetching branch ID:', params.id);
      const response = await fetch(`/api/branches/${params.id}`);
      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Branch data:', data);
        setBranch(data.branch);
      } else {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        setBranch(null);
      }
    } catch (error) {
      console.error('Error fetching branch:', error);
      setBranch(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 p-6">Loading...</div>;
  }

  if (!branch) {
    return <div className="min-h-screen bg-gray-50 p-6">Branch not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            href="/master/branches"
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back to Branches
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">{branch.nama_branch}</h1>
          <p className="text-gray-600 mt-2">Branch Details</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Branch Code</label>
              <p className="mt-1 text-sm text-gray-900">{branch.kode_branch || '-'}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Branch Name</label>
              <p className="mt-1 text-sm text-gray-900">{branch.nama_branch}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">City</label>
              <p className="mt-1 text-sm text-gray-900">{branch.kota}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Province</label>
              <p className="mt-1 text-sm text-gray-900">{branch.provinsi}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Operating Hours</label>
              <p className="mt-1 text-sm text-gray-900">
                {branch.jam_buka?.slice(0, 5)} - {branch.jam_tutup?.slice(0, 5)}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Operating Days</label>
              <p className="mt-1 text-sm text-gray-900">{branch.hari_operasional}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Person In Charge</label>
              <p className="mt-1 text-sm text-gray-900">{branch.pic?.full_name || branch.pic_id || '-'}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Status</label>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                branch.is_active 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {branch.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          
          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700">Address</label>
            <p className="mt-1 text-sm text-gray-900">{branch.alamat}</p>
          </div>

          <div className="flex justify-end space-x-4 mt-8">
            <Link
              href={`/master/branches/${branch.id_branch}/edit`}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Edit Branch
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}