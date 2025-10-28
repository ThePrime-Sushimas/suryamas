// app/master/branches/[id]/edit/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import BranchForm from '@/components/master/branches/BranchForm';
import { Branch } from '@/types/branch';
import { useEmployeesCache } from '@/hooks/useEmployeesCache'; // ✅ Import hook

export default function EditBranchPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [branch, setBranch] = useState<Branch | null>(null);
  const { employees, loading: loadingEmployees } = useEmployeesCache(); // ✅ Gunakan hook

  // HAPUS useEffect fetchEmployees yang lama

  useEffect(() => {
    if (params.id) {
      fetchBranch();
    }
  }, [params.id]);

  const fetchBranch = async () => {
    try {
      const response = await fetch(`/api/branches/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setBranch(data.branch);
      } else {
        setBranch(null);
      }
    } catch (error) {
      console.error('Error fetching branch:', error);
      setBranch(null);
    }
  };

  const handleSubmit = async (formData: any) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/branches/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update branch');
      }

      router.push('/master/branches');
    } catch (error) {
      console.error('Error updating branch:', error);
      alert(`Error updating branch: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!branch) {
    return <div className="min-h-screen bg-gray-50 p-6">Loading branch...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/master/branches" className="text-gray-600 hover:text-gray-900">
            ← Back to Branches
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Edit Branch</h1>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <BranchForm 
            employees={employees}
            initialData={branch}
            onSubmit={handleSubmit}
            loading={loading}
            submitText="Update Branch"
          />
        </div>
      </div>
    </div>
  );
}