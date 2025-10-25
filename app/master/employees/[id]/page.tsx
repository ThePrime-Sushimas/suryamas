'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/src/lib/supabaseClient';
import EmployeeCard from '@/components/master/employees/EmployeeCard';
import Link from 'next/link';

interface Employee {
  employee_id: string;
  full_name: string;
  organization: string;
  job_position: string;
  join_date: string;
  resign_date: string | null;
  status_employee: string;
  end_date: string | null;
  sign_date: string | null;
  email: string;
  birth_date: string;
  birth_place: string;
  citizen_id_address: string;
  npwp: string;
  ptkp_status: string;
  mobile_phone: string;
  branch_name: string;
  parent_branch_name: string;
  religion: string;
  gender: string;
  marital_status: string;
  bank_name: string;
  bank_account: string;
  bank_account_holder: string;
  currency: string;
  length_of_service: string;
  profile_picture_url: string | null;
}

export default function EmployeeDetailPage() {
  const params = useParams();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">Loading employee details...</div>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center text-gray-500">Employee not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href="/master/employees"
            className="text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Back to Employees
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{employee.full_name}</h1>
              <p className="text-gray-600 mt-2">
                {employee.job_position} • {employee.employee_id}
              </p>
            </div>
            <div className="flex space-x-3">
              <Link
                href={`/master/employees/${employee.employee_id}/edit`}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Edit Employee
              </Link>
              <button className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>

        {/* Employee Card */}
        <EmployeeCard employee={employee} />
      </div>
    </div>
  );
}