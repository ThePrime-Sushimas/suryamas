'use client';

import { useState, useEffect } from 'react';
import { EmployeeStatus,OrganizationType } from '@/types/employee';
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
    organization: OrganizationType.RESTAURANT,
    job_position: '',
    join_date: '',
    resign_date: '',
    status_employee: EmployeeStatus.CONTRACT,
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
    religion: '',
    gender: 'Male',
    marital_status: 'Single',
    bank_name: '',
    bank_account: '',
    bank_account_holder: '',
    currency: 'IDR',
    profile_picture_url: '',
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  useEffect(() => {
    const isTerminatedOrResign = ['Resign', 'Terminated'].includes(formData.status_employee);
    
    setFormData(prev => {
      const updates: any = {};
      
      // Auto-set resign_date jika status Resign/Terminated
      if (isTerminatedOrResign && !prev.resign_date) {
        updates.resign_date = new Date().toISOString().split('T')[0];
      } else if (!isTerminatedOrResign && prev.resign_date) {
        updates.resign_date = '';
      }
      
      // Auto-set is_deleted
      updates.is_deleted = isTerminatedOrResign;
      
      return { ...prev, ...updates };
    });
  }, [formData.status_employee]);

    // Auto-set resign_date ketika status berubah ke 'Resign' atau 'Terminated'
    useEffect(() => {
      if ((formData.status_employee === 'Resign' || formData.status_employee === 'Terminated') && !formData.resign_date) {
        setFormData(prev => ({
          ...prev,
          resign_date: new Date().toISOString().split('T')[0] // Today's date
        }));
      } else if (!['Resign', 'Terminated'].includes(formData.status_employee) && formData.resign_date) {
        // Clear resign_date jika status bukan 'Resign' atau 'Terminated'
        setFormData(prev => ({
          ...prev,
          resign_date: ''
        }));
      }
    }, [formData.status_employee]);
  
    // Auto-clear end_date jika status bukan contract/part time
    useEffect(() => {
      if (!['Contract', 'Part Time'].includes(formData.status_employee) && formData.end_date) {
        setFormData(prev => ({
          ...prev,
          end_date: ''
        }));
      }
    }, [formData.status_employee]);  

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const shouldBeDeleted = ['Resign', 'Terminated'].includes(formData.status_employee);

    // Convert empty strings to null for date fields
    const submitData = {
      ...formData,
      resign_date: formData.resign_date || null,
      end_date: formData.end_date || null,
      sign_date: formData.sign_date || null,
      is_deleted: shouldBeDeleted, // ✅ AUTO SET is_deleted
      updated_at: new Date().toISOString(),

    };    
    onSubmit(submitData);
  };

  const [branches, setBranches] = useState<string[]>([]);
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch('/api/branches?limit=100');
        const data = await response.json();
        const branchNames = data.branches?.map((branch: any) => branch.nama_branch) || [];
        setBranches(branchNames);
      } catch (error) {
        console.error('Error fetching branches:', error);
      }
    };
    fetchBranches();
  }, []);

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
            <option value="CENTRAL">CENTRAL</option>
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

        {/* Sign Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sign Date *
          </label>
          <input
            type="date"
            name="sign_date"
            value={formData.sign_date || ''}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="text-sm text-gray-500 mt-1">Tanggal penandatanganan kontrak</p>
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
            <option value="Resign">Resign</option>
            <option value="Terminated">Terminated</option>
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
        {/* End Date (Conditional) */}
        {(formData.status_employee === 'Contract' || formData.status_employee === 'Part Time') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              name="end_date"
              value={formData.end_date || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-1">Tanggal berakhir kontrak</p>
          </div>
        )}

        {/* Resign Date (Conditional) */}
        {(formData.status_employee === 'Resign' || formData.status_employee === 'Terminated') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resign Date
            </label>
            <input
              type="date"
              name="resign_date"
              value={formData.resign_date || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-1">
              {!initialData?.resign_date ? 'Otomatis terisi hari ini' : 'Tanggal resign'}
            </p>
          </div>
        )}

        {/* Personal Information */}
        <div className="md:col-span-2 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Religion
          </label>
          <select
            name="religion"
            value={formData.religion}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Religion</option>
            <option value="Islam">Islam</option>
            <option value="Christian">Christian</option>
            <option value="Catholic">Catholic</option>
            <option value="Hindu">Hindu</option>
            <option value="Buddha">Buddha</option>
            <option value="Others">Others</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email *
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mobile Phone *
          </label>
          <input
            type="text"
            name="mobile_phone"
            value={formData.mobile_phone}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Birth Place
          </label>
          <input
            type="text"
            name="birth_place"
            value={formData.birth_place}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
            placeholder="Tempat lahir"
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            PTKP Status
          </label>
          <select
            name="ptkp_status"
            value={formData.ptkp_status}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="TK/0">TK/0 - Tidak Kawin Tanggungan 0</option>
            <option value="TK/1">TK/1 - Tidak Kawin Tanggungan 1</option>
            <option value="TK/2">TK/2 - Tidak Kawin Tanggungan 2</option>
            <option value="K/0">K/0 - Kawin Tanggungan 0</option>
            <option value="K/1">K/1 - Kawin Tanggungan 1</option>
            <option value="K/2">K/2 - Kawin Tanggungan 2</option>
            <option value="K/3">K/3 - Kawin Tanggungan 3</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            NPWP
          </label>
          <input
            type="text"
            name="npwp"
            value={formData.npwp || ''}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
            placeholder="Nomor NPWP"
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