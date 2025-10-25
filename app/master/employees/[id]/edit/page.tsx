'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/src/lib/supabaseClient';
import EmployeeForm from '@/components/master/employees/EmployeeForm';
import Link from 'next/link';

interface Employee {
  employee_id: string;
  full_name: string;
  // ... semua field employees
}

export default function EditEmployeePage() {
  const router = useRouter();
  const params = useParams();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchEmployee();
    }
  }, [params.id]);

  const fetchEmployee = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('employee_id', params.id)
        .single();

      if (error) throw error;
      setEmployee(data);
    } catch (error) {
      console.error('Error fetching employee:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (formData: any) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('employees')
        .update(formData)
        .eq('employee_id', params.id);

      if (error) throw error;

      // Redirect ke detail page setelah berhasil
      router.push(`/master/employees/${params.id}`);
    } catch (error) {
      console.error('Error updating employee:', error);
      alert('Failed to update employee');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">Loading employee data...</div>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">Employee not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href={`/master/employees/${params.id}`}
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Employee Details
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Edit Employee</h1>
          <p className="text-gray-600 mt-2">
            Update employee information
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <EmployeeForm 
            onSubmit={handleSubmit}
            loading={updating}
            submitText="Update Employee"
            initialData={employee}
          />
        </div>
      </div>
    </div>
  );
}