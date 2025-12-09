import { Link, useLocation } from 'react-router-dom'

export default function BottomNav() {
  const location = useLocation()

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 md:hidden">
      <div className="flex justify-around items-center h-16">
        <Link to="/" className={`flex flex-col items-center justify-center flex-1 ${isActive('/') ? 'text-blue-600' : 'text-gray-600'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-xs mt-1">Home</span>
        </Link>
        <Link to="/employees" className={`flex flex-col items-center justify-center flex-1 ${isActive('/employees') ? 'text-blue-600' : 'text-gray-600'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-xs mt-1">Employees</span>
        </Link>
        <Link to="/profile" className={`flex flex-col items-center justify-center flex-1 ${isActive('/profile') ? 'text-blue-600' : 'text-gray-600'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-xs mt-1">Profile</span>
        </Link>
      </div>
    </div>
  )
}
