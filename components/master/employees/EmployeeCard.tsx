'use client';
import { EmployeeStatus } from '@/types/employee';
import { getLengthOfServiceDisplay } from '@/utils/dateCalculations';
import Link from 'next/link';

interface Employee {
  employee_id: string;
  full_name: string;
  organization: string;
  job_position: string;
  join_date: string;
  resign_date: string | null;
  status_employee: EmployeeStatus;
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
  profile_picture_url: string | null;
}

interface EmployeeCardProps {
  employee: Employee;
  onClick?: (employee: Employee, sortBy: string) => void;
  sortable?: boolean;
  showActions?: boolean;
  returnUrl?: string;
}

export default function EmployeeCard({ 
  employee, 
  onClick, 
  sortable = false, 
  showActions = false,
  returnUrl 
}: EmployeeCardProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const lengthOfService = getLengthOfServiceDisplay(employee.join_date, employee.resign_date);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Permanent':
        return 'text-green-800 uppercase';
      case 'Contract':
        return 'text-orange-800 uppercase';
      case 'Part Time':
        return 'text-blue-800 uppercase';
      case 'Resign':
        return 'text-red-800 uppercase';
      default:
        return 'text-gray-800 uppercase';
    }
  };

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  const handleCardClick = (sortBy: string) => {
    if (sortable && onClick) {
      onClick(employee, sortBy);
    }
  };

  return (
    <div 
      className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-200 ${
        sortable ? 'cursor-pointer' : ''
      }`}
    >
      {/* Header - Clickable untuk sort by name */}
      <div 
        className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-t-lg text-white"
        onClick={() => handleCardClick('name')}
      >
        <div className="flex items-center justify-between"> {/* ✅ UBAH KE FLEX BETWEEN */}
          <div className="flex items-center space-x-4">
            {employee.profile_picture_url ? (
              <img
                src={employee.profile_picture_url}
                alt={employee.full_name}
                className="h-16 w-16 rounded-full object-cover border-2 border-white"
              />
            ) : (
              <div className="h-16 w-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <span className="text-xl font-bold">
                  {employee.full_name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold uppercase">{employee.full_name}</h2>
              <p className="text-blue-100">
                {employee.job_position} • {employee.employee_id}
              </p>
            </div>
          </div>
          
          {/* ✅ TAMBAHKAN ACTION BUTTONS */}
          {showActions && (
            <div className="flex space-x-2">
              <Link
                href={`/master/employees/${employee.employee_id}/edit${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}
                className="bg-black-600 text-white px-4 py-2 rounded-lg hover:bg-black-700 transition-colors"
              >
                Edit Employee
              </Link>
              {/* Bisa tambahkan tombol lain seperti Delete, View Details, dll */}
            </div>
          )}
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employment Information */}
          <div className="lg:col-span-2 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Employment Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  onClick={() => handleCardClick('branch')}
                  className={sortable ? 'cursor-pointer hover:bg-gray-50 p-2 rounded' : ''}
                >
                  <label className="text-sm font-medium text-gray-500 uppercase">Branch</label>
                  <p className="text-gray-900">{employee.branch_name}</p>
                </div>
                <div 
                  onClick={() => handleCardClick('organization')}
                  className={sortable ? 'cursor-pointer hover:bg-gray-50 p-2 rounded' : ''}
                >
                  <label className="text-sm font-medium text-gray-500">Organization</label>
                  <p className="text-gray-900">{employee.organization}</p>
                </div>
                <div 
                  onClick={() => handleCardClick('status')}
                  className={sortable ? 'cursor-pointer hover:bg-gray-50 p-2 rounded' : ''}
                >
                  <label className="text-sm font-medium text-gray-500 uppercase">Status</label>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(employee.status_employee)}`}>
                    {employee.status_employee}
                  </span>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Sign Date</label>
                  <p className="text-gray-900">{formatDate(employee.sign_date)}</p>
                </div>              
                <div 
                  onClick={() => handleCardClick('join_date')}
                  className={sortable ? 'cursor-pointer hover:bg-gray-50 p-2 rounded' : ''}
                >
                  <label className="text-sm font-medium text-gray-500">Join Date</label>
                  <p className="text-gray-900">{formatDate(employee.join_date)}</p>
                </div>

                {employee.end_date && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">End Date</label>
                    <p className="text-gray-900">{formatDate(employee.end_date)}</p>
                  </div>
                )}
                {employee.resign_date && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Resign Date</label>
                      <p className="text-gray-900">{formatDate(employee.resign_date)}</p>
                    </div>
                  )}
              <div>
                <label className="text-sm font-medium text-gray-500">Length of Service</label>
                <p className="text-gray-900">{lengthOfService}</p>
              </div>
              </div>
            </div>

            {/* Personal Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-gray-900">{employee.email || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Mobile Phone</label>
                  <p className="text-gray-900">{employee.mobile_phone || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 uppercase">Birth Date</label>
                  <p className="text-gray-900">
                    {employee.birth_date ? `${formatDate(employee.birth_date)} (${calculateAge(employee.birth_date)} years)` : '-'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Birth Place</label>
                  <p className="text-gray-900 uppercase">{employee.birth_place || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Gender</label>
                  <p className="text-gray-900 uppercase">{employee.gender}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Marital Status</label>
                  <p className="text-gray-900 uppercase">{employee.marital_status}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Religion</label>
                  <p className="text-gray-900 uppercase">{employee.religion || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">PTKP Status</label>
                  <p className="text-gray-900">{employee.ptkp_status}</p>
                </div>
              </div>
            </div>  

            {/* Address */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Address</h3>
              <p className="text-gray-900 whitespace-pre-line">{employee.citizen_id_address || '-'}</p>
            </div>
          </div>

          {/* Bank & Tax Information */}
          <div className="space-y-6">
            {/* Bank Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">Bank Name</label>
                  <p className="text-gray-900 uppercase">{employee.bank_name || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Account Number</label>
                  <p className="text-gray-900">{employee.bank_account || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Account Holder</label>
                  <p className="text-gray-900 uppercase">{employee.bank_account_holder || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Currency</label>
                  <p className="text-gray-900">{employee.currency}</p>
                </div>
              </div>
            </div>

            {/* Tax Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tax Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-500">NPWP</label>
                  <p className="text-gray-900">{employee.npwp || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">PTKP Status</label>
                  <p className="text-gray-900">{employee.ptkp_status}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}