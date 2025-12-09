import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import BottomNav from '../mobile/BottomNav'
import { useAuthStore } from '../../stores/authStore'

export default function Layout() {
  const { user } = useAuthStore()
  const location = useLocation()
  const isAuthPage = ['/login', '/register', '/forgot-password', '/reset-password'].includes(location.pathname)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8 pb-20 md:pb-8">
        <Outlet />
      </main>
      {user && !isAuthPage && <BottomNav />}
    </div>
  )
}
