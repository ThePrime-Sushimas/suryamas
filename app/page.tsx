// app/page.tsx
import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Suryamas
        </h1>
        <p className="text-gray-600 mb-8">
          Employee Management System
        </p>
        <Link 
          href="/master/employees"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Go to Employees
        </Link>
      </div>
    </div>
  );
}