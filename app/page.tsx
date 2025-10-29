import Link from 'next/link';
import MainLayout from '@/components/layout/MainLayout';

export default function Home() {
  return (
    <MainLayout>
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Suryamas
          </h1>
          <p className="text-gray-600 mb-8">
            Employee Management System
          </p>
          <div className="space-x-4">
            <Link 
              href="/master/employees"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Employees
            </Link>
            <Link
              href="/master/branches"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Branches
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}