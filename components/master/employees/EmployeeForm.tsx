'use client';

import { useState, useEffect } from 'react';
import ProfilePictureUpload from './ProfilePictureUpload';

interface EmployeeFormProps {
  onSubmit: (data: any) => void;
  loading: boolean;
  submitText: string;
  initialData?: any;
}

export default function EmployeeForm({ 
  onSubmit, 
  loading, 
  submitText, 
  initialData 
}: EmployeeFormProps) {
  const [formData, setFormData] = useState({
    employee_id: '',
    full_name: '',
    organization: 'RESTAURANT',
    job_position: '',
    join_date: '',
    resign_date: '',
    status_employee: 'Contract',
    end_date: '',
    sign_date: '',
    email: '',
    birth_date: '',
    birth_place: '',
    citizen_id_address: '',
    npwp: '',
    ptkp_status: 'TK/0',
    mobile_phone: '',
    branch_name: '',
    parent_branch_name: '',
    religion: '',
    gender: 'Male',
    marital_status: 'Single',
    bank_name: '',
    bank_account: '',
    bank_account_holder: '',
    currency: 'IDR',
    length_of_service: '',
    profile_picture_url: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const branches = ['CIBINONG', 'CONDET', 'DEPOK', 'GALAXY', 'GRANDWIS', 'SERPONG', 'PUSAT'];
  const positions = ['SUSHIMAN', 'BARISTA', 'SERVER', 'COOK', 'MANAGER', 'SEKRETARIS', 'DISHWASHER', 'HELPER', 'Stock Keeper'];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Basic Information */}
        <div className="md:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
        </div>
        
        <div className="md:col-span-2">
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Profile Picture
  </label>
  <ProfilePictureUpload
    employeeId={formData.employee_id}
    currentImageUrl={formData.profile_picture_url}
    onUpload={(url: string) => setFormData(prev => ({ ...prev, profile_picture_url: url }))} // ✅ ADD TYPE
  />
</div>  

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Employee ID *
          </label>
          <input
            type="text"
            name="employee_id"
            value={formData.employee_id}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., SCI921SU0020"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name *
          </label>
          <input
            type="text"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Organization
          </label>
          <select
            name="organization"
            value={formData.organization}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="RESTAURANT">RESTAURANT</option>
            <option value="OFFICE">OFFICE</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Job Position *
          </label>
          <select
            name="job_position"
            value={formData.job_position}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Position</option>
            {positions.map(position => (
              <option key={position} value={position}>{position}</option>
            ))}
          </select>
        </div>

        {/* Employment Details */}
        <div className="md:col-span-2 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Employment Details</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Join Date *
          </label>
          <input
            type="date"
            name="join_date"
            value={formData.join_date}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            name="status_employee"
            value={formData.status_employee}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="Permanent">Permanent</option>
            <option value="Contract">Contract</option>
            <option value="Part Time">Part Time</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Branch *
          </label>
          <select
            name="branch_name"
            value={formData.branch_name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Branch</option>
            {branches.map(branch => (
              <option key={branch} value={branch}>{branch}</option>
            ))}
          </select>
        </div>

        {/* Personal Information */}
        <div className="md:col-span-2 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mobile Phone
          </label>
          <input
            type="text"
            name="mobile_phone"
            value={formData.mobile_phone}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Birth Date
          </label>
          <input
            type="date"
            name="birth_date"
            value={formData.birth_date}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Gender
          </label>
          <select
            name="gender"
            value={formData.gender}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>

        {/* Bank Information */}
        <div className="md:col-span-2 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Information</h3>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bank Name
          </label>
          <input
            type="text"
            name="bank_name"
            value={formData.bank_name}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bank Account
          </label>
          <input
            type="text"
            name="bank_account"
            value={formData.bank_account ?? ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
          />
        </div>

        {/* Address */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Address
          </label>
          <textarea
            name="citizen_id_address"
            value={formData.citizen_id_address ?? ''}
            onChange={handleChange}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
          />
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-6 border-t">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Saving...' : submitText}
        </button>
      </div>
    </form>
  );
}