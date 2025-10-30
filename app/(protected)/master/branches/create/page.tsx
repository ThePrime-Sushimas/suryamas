'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import BranchForm from '@/components/master/branches/BranchForm';
import { useEmployeesCache } from '@/hooks/useEmployeesCache';

export default function CreateBranchPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { employees, loading: loadingEmployees } = useEmployeesCache(); 

  const handleSubmit = async (formData: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/branches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create branch');
      }

      router.push('/master/branches');
    } catch (error) {
      console.error('Error creating branch:', error);
      alert(`Error creating branch: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Add New Branch</h1>
          <p className="text-gray-600 mt-2">Create a new restaurant branch</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <BranchForm 
            employees={employees}
            onSubmit={handleSubmit}
            loading={loading}
            submitText="Create Branch"
          />
          
          <div className="flex justify-start mt-6">
            <Link
              href="/master/branches"
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}