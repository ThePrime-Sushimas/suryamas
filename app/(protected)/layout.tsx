'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import LayoutClient from '@/components/layout/LayoutClient';

// Route permission mapping based on URL structure
const getRoutePermission = (pathname: string): string | null => {
  if (pathname.startsWith('/master')) {
    // Extract specific permission from URL
    const parts = pathname.split('/');
    if (parts[2]) {
      return `${parts[2]}.view`; // e.g., users.view, roles.view
    }
    return 'master.access';
  }
  
  if (pathname.startsWith('/finance')) return 'finance.access';
  if (pathname.startsWith('/system')) return 'system.access';
  if (pathname.startsWith('/reports')) return 'reports.view';
  
  return null; // No special permission required (dashboard, profile)
};

export default function ProtectedLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const { user, hasPermission, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // Check authentication
    if (!user) {
      router.push('/auth/login');
      return;
    }

    // Check route-specific permissions
    const requiredPermission = getRoutePermission(pathname);
    if (requiredPermission && !hasPermission(requiredPermission)) {
      router.push('/unauthorized');
      return;
    }
  }, [user, pathname, loading, hasPermission, router]);

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render if not authenticated
  if (!user) {
    return null;
  }

  // Single layout with permission checking
  return (
    <LayoutClient>
      {children}
    </LayoutClient>
  );
}