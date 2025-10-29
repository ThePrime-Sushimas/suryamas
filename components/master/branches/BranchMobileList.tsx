// components/master/branches/BranchMobileList.tsx
import { Branch } from '@/types/branch';
import Link from 'next/link';

interface BranchMobileListProps {
  branches: Branch[];
  currentUrl: string;
}

export default function BranchMobileList({ branches, currentUrl }: BranchMobileListProps) {
  return (
    <div className="space-y-3 md:hidden">
      {branches.map((branch) => (
        <div key={branch.id_branch} className="bg-white p-4 rounded-lg shadow border">
          <div className="flex justify-between items-start mb-2">
          <Link
                        href={`/master/branches/${branch.id_branch}`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                        >
            <h3 className="font-semibold text-blue-900">{branch.nama_branch}</h3>
            </Link>
            <span className={`px-2 py-1 text-xs rounded-full ${
              branch.is_active 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {branch.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>

          
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{branch.kota}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              <span>{branch.kode_branch}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{branch.jam_buka} - {branch.jam_tutup}</span>
            </div>

            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{branch.hari_operasional}</span>
            </div>
            
            {branch.alamat && (
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                <span className="flex-1 text-xs">{branch.alamat}</span>
              </div>
            )}

            {branch.pic && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="text-xs">
                  PIC: {branch.pic.full_name} ({branch.pic.job_position})
                </span>
              </div>
            )}
            
            <div className="flex gap-2 pt-2 border-t border-gray-100">
              <Link
                href={`/master/branches/${branch.id_branch}/edit?returnUrl=${encodeURIComponent(currentUrl)}`}
                className="text-indigo-600 hover:text-indigo-900 text-sm"
              >
                Edit
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}