'use client';

import { useState, useEffect } from 'react';
import { HariOperasional } from '@/types/branch';
import { Employee } from '@/types/employee';

interface BranchFormProps {
  employees: Employee[];
  loadingEmployees?: boolean; 
  initialData?: any;
  onSubmit: (data: any) => void;
  loading: boolean;
  submitText: string;
}

export default function BranchForm({ employees,loadingEmployees = false, initialData, onSubmit, loading, submitText }: BranchFormProps) {
  const [formData, setFormData] = useState({
    kode_branch: '',
    nama_branch: '',
    alamat: '',
    kota: '',
    provinsi: '',
    brand: '',
    jam_buka: '08:00',
    jam_tutup: '17:00',
    hari_operasional: 'Senin-Jumat' as HariOperasional,
    pic_id: '',

    badan: '',
    is_active: true
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        kode_branch: initialData.kode_branch || '',
        nama_branch: initialData.nama_branch || '',
        alamat: initialData.alamat || '',
        kota: initialData.kota || '',
        provinsi: initialData.provinsi || '',
        brand: initialData.brand || '',
        jam_buka: initialData.jam_buka?.slice(0, 5) || '08:00',
        jam_tutup: initialData.jam_tutup?.slice(0, 5) || '17:00',
        hari_operasional: initialData.hari_operasional || 'Senin-Jumat',
        pic_id: initialData.pic_id || '',

        badan: initialData.badan || '',
        is_active: initialData.is_active ?? true
      });
    }
  }, [initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Branch Code
          </label>
          <input
            type="text"
            name="kode_branch"
            value={formData.kode_branch}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="e.g., BR001"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Branch Name *
          </label>
          <input
            type="text"
            name="nama_branch"
            value={formData.nama_branch}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Branch name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            City *
          </label>
          <input
            type="text"
            name="kota"
            value={formData.kota}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="City"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Province *
          </label>
          <input
            type="text"
            name="provinsi"
            value={formData.provinsi}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Province"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Brand
          </label>
          <input
            type="text"
            name="brand"
            value={formData.brand}
            onChange={handleChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Brand name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Person in Charge *
          </label>
          <select
            name="pic_id"
            value={formData.pic_id}
            onChange={handleChange}
            required
            disabled={loadingEmployees} 
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Employee</option>
            {employees.map((emp) => (
              <option key={emp.employee_id} value={emp.employee_id}>
                {emp.full_name} - {emp.job_position}
              </option>
            ))}
          </select>
        </div>

        {initialData && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              name="is_active"
              value={formData.is_active.toString()}
              onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.value === 'true' }))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Opening Time *
          </label>
          <input
            type="time"
            name="jam_buka"
            value={formData.jam_buka}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Closing Time *
          </label>
          <input
            type="time"
            name="jam_tutup"
            value={formData.jam_tutup}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Operating Days *
          </label>
          <select
            name="hari_operasional"
            value={formData.hari_operasional}
            onChange={handleChange}
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="Senin-Jumat">Senin-Jumat</option>
            <option value="Senin-Sabtu">Senin-Sabtu</option>
            <option value="Setiap Hari">Setiap Hari</option>
            <option value="Senin-Minggu">Senin-Minggu</option>
          </select>
        </div>


      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Address *
        </label>
        <textarea
          name="alamat"
          value={formData.alamat}
          onChange={handleChange}
          required
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Full address"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Badan Hukum
        </label>
        <textarea
          name="badan"
          value={formData.badan}
          onChange={handleChange}
          rows={3}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Branch description"
        />
      </div>

      <div className="flex justify-end space-x-4 pt-6">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Processing...' : submitText}
        </button>
      </div>
    </form>
  );
}