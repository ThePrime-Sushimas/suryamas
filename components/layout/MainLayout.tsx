'use client';

import { useAuth } from '@/hooks/useAuth';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';
import LoadingSpinner from './LoadingSpinner';
import ErrorBoundary from './ErrorBoundary';

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Please Login</h1>
          <p className="text-gray-600">You need to be authenticated to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 min-h-screen">
            {children}
          </main>
        </div>
        <Footer />
      </div>
    </ErrorBoundary>
  );
}