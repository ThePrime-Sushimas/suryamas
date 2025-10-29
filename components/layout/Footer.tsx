// components/layout/Footer.tsx
export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-white border-t border-gray-200 py-4 px-6">
      <div className="flex flex-col sm:flex-row justify-between items-center">
        <div className="text-sm text-gray-600 mb-2 sm:mb-0">
          © {currentYear} Restaurant Management System. All rights reserved.
        </div>
        <div className="flex items-center space-x-6 text-sm text-gray-500">
          <span>v1.0.0</span>
          <span>•</span>
          <span>Production</span>
        </div>
      </div>
    </footer>
  )
}