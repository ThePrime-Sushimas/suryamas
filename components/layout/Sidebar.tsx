// components/layout/Sidebar.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  userRole?: string
}

interface MenuItem {
  name: string
  href: string
  icon: string
  permission?: string // Permission required to access this menu
  children?: MenuItem[]
}

const menuItems: MenuItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: '📊'
  },
  {
    name: 'Master Data',
    href: '/master',
    icon: '🗃️',
    permission: 'master.access',
    children: [
      {
        name: 'Users',
        href: '/master/users',
        icon: '👤',
        permission: 'users.view'
      },
      {
        name: 'Roles',
        href: '/master/roles',
        icon: '🔐',
        permission: 'roles.view'
      },
      {
        name: 'Permissions',
        href: '/master/permissions',
        icon: '🔑',
        permission: 'permissions.view'
      },
      {
        name: 'Employees',
        href: '/master/employees',
        icon: '👥',
        permission: 'employees.view'
      },
      {
        name: 'Branches',
        href: '/master/branches',
        icon: '🏪',
        permission: 'branches.view'
      }
    ]
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: '📈',
    permission: 'reports.view'
  },
  {
    name: 'System',
    href: '/system',
    icon: '⚙️',
    permission: 'system.access',
    children: [
      {
        name: 'Audit Logs',
        href: '/system/audit-logs',
        icon: '📋',
        permission: 'system.audit_logs'
      },
      {
        name: 'Settings',
        href: '/system/settings',
        icon: '🔧',
        permission: 'system.settings'
      }
    ]
  }
]

export default function Sidebar({ isOpen, onClose, userRole }: SidebarProps) {
  const pathname = usePathname()
  const { user, hasPermission } = useAuth()
  const [expandedMenus, setExpandedMenus] = useState<string[]>([])

  const toggleMenu = (menuName: string) => {
    setExpandedMenus(prev =>
      prev.includes(menuName)
        ? prev.filter(item => item !== menuName)
        : [...prev, menuName]
    )
  }

  const hasAccess = (permission?: string) => {
    if (!permission) return true; // No permission required
    
    // Super admin with wildcard permission has access to everything
    if (user?.permissions?.includes('*')) return true;
    
    return hasPermission(permission);
  }

  const hasAccessToChildren = (children?: MenuItem[]) => {
    if (!children) return false;
    return children.some(child => hasAccess(child.permission));
  }

  const shouldShowMenuItem = (item: MenuItem) => {
    // If item has children, show if user has access to any child
    if (item.children) {
      return hasAccessToChildren(item.children);
    }
    // If no children, check item's own permission
    return hasAccess(item.permission);
  }

  const renderMenuItems = (items: MenuItem[]) => {
    return items
      .filter(item => shouldShowMenuItem(item))
      .map(item => (
        <div key={item.href}>
          {item.children ? (
            <div>
              <button
                onClick={() => toggleMenu(item.name)}
                className={`w-full flex items-center justify-between px-4 py-3 text-left rounded-lg transition-colors ${
                  pathname.startsWith(item.href)
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span>{item.icon}</span>
                  <span className="font-medium">{item.name}</span>
                </div>
                <svg
                  className={`w-4 h-4 transition-transform ${
                    expandedMenus.includes(item.name) ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {expandedMenus.includes(item.name) && (
                <div className="ml-6 mt-1 space-y-1">
                  {renderMenuItems(item.children)}
                </div>
              )}
            </div>
          ) : (
            <Link
              href={item.href}
              onClick={onClose}
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                pathname === item.href
                  ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span>{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </Link>
          )}
        </div>
      ))
  }

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:inset-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">RMS</h2>
              <p className="text-xs text-gray-500 capitalize">{userRole} Access</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {renderMenuItems(menuItems)}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {(user?.full_name || user?.username)?.[0]?.toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.full_name || user?.username}
              </p>
              <p className="text-xs text-gray-500 truncate capitalize">
                {user?.branch_name}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}