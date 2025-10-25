'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/src/lib/supabaseClient';
import EmployeeForm from '@/components/master/employees/EmployeeForm';
import Link from 'next/link';

export default function CreateEmployeePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (formData: any) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .insert([formData])
        .select();

      if (error) throw error;

      // Redirect ke detail page setelah berhasil
      router.push(`/employees/${data[0].employee_id}`);
    } catch (error) {
      console.error('Error creating employee:', error);
      alert('Failed to create employee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/master/employees"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Employees
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Add New Employee</h1>
          <p className="text-gray-600 mt-2">
            Fill in the details to add a new employee to the system
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <EmployeeForm 
            onSubmit={handleSubmit}
            loading={loading}
            submitText="Create Employee"
          />
        </div>
      </div>
    </div>
  );
}