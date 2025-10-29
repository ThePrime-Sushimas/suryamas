'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient'; 

interface ProfilePictureUploadProps {
  employeeId: string;
  currentImageUrl?: string;
  onUpload: (url: string) => void;
}

export default function ProfilePictureUpload({ 
  employeeId, 
  currentImageUrl, 
  onUpload 
}: ProfilePictureUploadProps) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      
      // Validasi file size (3MB)
      if (file.size > 3 * 1024 * 1024) {
        throw new Error('File size must be less than 3MB');
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${employeeId}.${fileExt}`;
      const filePath = `employee-photos/${fileName}`; // ✅ FIX BUCKET NAME

      // Upload ke Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('employee-photos') // ✅ PASTIKAN BUCKET INI ADA
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Dapatkan public URL
      const { data: { publicUrl } } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(filePath);

      // ✅ HAPUS DUPLICATE CODE - HANYA PERLU SEKALI
      onUpload(publicUrl);
      
    } catch (error) {
      console.error('Error uploading image:', error);
      alert(error instanceof Error ? error.message : 'Error uploading image!');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center space-x-4">
      {/* Current Photo */}
      <div className="relative">
        {currentImageUrl ? (
          <img
            src={currentImageUrl}
            alt="Profile"
            className="h-16 w-16 rounded-full object-cover border border-gray-300"
          />
        ) : (
          <div className="h-16 w-16 bg-gray-300 rounded-full flex items-center justify-center border border-gray-400">
            <span className="text-gray-600 text-sm">No Photo</span>
          </div>
        )}
      </div>

      {/* Upload Button */}
      <div>
        <label className="bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors inline-block">
          {uploading ? 'Uploading...' : 'Upload Photo'}
          <input
            type="file"
            accept="image/*"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
        <p className="text-sm text-gray-500 mt-1">
          JPG, PNG max 3MB
        </p>
      </div>
    </div>
  );
}