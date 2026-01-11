import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useLocation, Link, Outlet, useNavigate } from 'react-router-dom'
import { Menu, X, ChevronDown, ChevronRight, LayoutDashboard, Key, Package, Factory, Warehouse, Users, Settings, LogOut, Bell, Search, User, ShoppingCart, Building2, UserCog, Shield, DollarSign } from 'lucide-react'
import { useAuthStore } from '@/features/auth'
import { BranchSwitcher, usePermissionStore } from '@/features/branch_context'

interface MenuItem {
  id: string
  name: string
  href?: string
  icon: React.ReactNode
  submenu?: MenuItem[]
  disabled?: boolean
  badge?: number
  module?: string
}

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { permissions, isLoaded } = usePermissionStore()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  const menuItems: MenuItem[] = useMemo(() => [
    {
      id: 'dashboard',
      name: 'Dashboard',
      href: '/',
      icon: <LayoutDashboard size={18} />
    },
    {
      id: 'master-data',
      name: 'Master Data',
      icon: <Package size={18} />,
      submenu: [
        { id: 'companies', name: 'Companies', href: '/companies', icon: <Factory size={16} />, module: 'companies' },
        { id: 'branches', name: 'Branches', href: '/branches', icon: <Warehouse size={16} />, module: 'branches' },
        { id: 'categories', name: 'Categories', href: '/categories', icon: <Package size={16} />, module: 'categories' },
        { id: 'sub-categories', name: 'Sub Categories', href: '/sub-categories', icon: <Package size={16} />, module: 'sub_categories' },
        { id: 'metric-units', name: 'Metric Units', href: '/metric-units', icon: <Package size={16} />, module: 'metric-units' },
        { id: 'payment-terms', name: 'Payment Terms', href: '/payment-terms', icon: <Package size={16} />, module: 'payment_terms' },
      ]
    },
    {
      id: 'products',
      name: 'Products',
      icon: <ShoppingCart size={18} />,
      submenu: [
        { id: 'products', name: 'Products', href: '/products', icon: <Package size={16} />, module: 'products' },
        { id: 'suppliers', name: 'Suppliers', href: '/suppliers', icon: <Building2 size={16} />, module: 'suppliers' },
        { id: 'supplier-products', name: 'Supplier Products', href: '/supplier-products', icon: <ShoppingCart size={16} />, module: 'supplier_products' },
        { id: 'pricelists', name: 'Pricelists', href: '/pricelists', icon: <DollarSign size={16} />, module: 'pricelists' },
      ]
    },
    {
      id: 'hr',
      name: 'Human Resources',
      icon: <Users size={18} />,
      submenu: [
        { id: 'employees', name: 'Employees', href: '/employees', icon: <Users size={16} />, module: 'employees' },
        { id: 'employee_branches', name: 'Employee Branches', href: '/employee-branches', icon: <Building2 size={16} />, module: 'employee_branches' },
      ]
    },
    {
      id: 'settings',
      name: 'Settings',
      icon: <Settings size={18} />,
      submenu: [
        { id: 'users', name: 'Users', href: '/users', icon: <UserCog size={16} />, module: 'users' },
        { id: 'permissions', name: 'Permissions', href: '/permissions', icon: <Shield size={16} />, module: 'permissions' },
      ]
    },
  ], [])

  const filteredMenuItems = useMemo(() => {
    if (!isLoaded) return menuItems
    
    return menuItems.map(item => {
      if (item.submenu) {
        const filteredSubmenu = item.submenu.filter(subItem => {
          if (!subItem.module) return true
          return permissions[subItem.module]?.view === true
        })
        return { ...item, submenu: filteredSubmenu }
      }
      return item
    }).filter(item => {
      if (item.submenu) return item.submenu.length > 0
      return true
    })
  }, [menuItems, permissions, isLoaded])

  const toggleSubmenu = useCallback((menuId: string) => {
    setActiveSubmenu(prev => prev === menuId ? null : menuId)
  }, [])

  const isActiveMenu = useCallback((href?: string) => {
    return href === location.pathname
  }, [location.pathname])

  const isSubmenuActive = useCallback((submenu?: MenuItem[]) => {
    return submenu?.some(item => isActiveMenu(item.href))
  }, [isActiveMenu])

  // Auto buka submenu berdasarkan current route
  useEffect(() => {
    filteredMenuItems.forEach(item => {
      if (item.submenu) {
        if (item.submenu.some(subItem => subItem.href === location.pathname)) {
          setActiveSubmenu(item.id)
        }
      }
    })
  }, [location.pathname, filteredMenuItems])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const userInitial = user?.full_name?.charAt(0).toUpperCase() || 'U'

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="mr-2 p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 lg:hidden"
                aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
              >
                {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="hidden lg:block mr-2 p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <Menu size={20} />
              </button>
              <Link to="/" className="flex items-center">
                <div className="h-10 w-10 bg-linear-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center text-white font-bold mr-3">
                  SIS
                </div>
                <div className="hidden sm:block">
                  <div className="text-xl font-bold text-gray-800 dark:text-white">Sushimas</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 -mt-1">Internal System V.2</div>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <BranchSwitcher />
              <button 
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                aria-label="Search"
              >
                <Search size={20} />
              </button>
              <button 
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 relative"
                aria-label="Notifications"
              >
                <Bell size={20} />
                <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" aria-hidden="true"></span>
              </button>
              
              {/* Profile Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Profile menu"
                  aria-expanded={isProfileOpen}
                >
                  <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                    {userInitial}
                  </div>
                  <ChevronDown size={16} className={`transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{user?.full_name || 'User'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email || 'user@example.com'}</p>
                    </div>
                    <Link
                      to="/profile"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <User size={16} />
                      Profile
                    </Link>
                    <Link
                      to="/reset-password"
                      onClick={() => setIsProfileOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      <Key size={16} />
                      Reset Password
                    </Link>
                    <button
                      onClick={() => {
                        setIsProfileOpen(false)
                        handleLogout()
                      }}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 border-t border-gray-200 dark:border-gray-700"
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div 
          ref={sidebarRef}
          className={`
            fixed inset-y-0 left-0 z-30 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-all duration-200 ease-in-out lg:static lg:translate-x-0 lg:shadow-none
            ${isSidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}
            ${isSidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
            w-64
          `}
        >
          <nav className="mt-8 px-4 h-[calc(100vh-8rem)] overflow-y-auto">
            <div className="space-y-1">
              {filteredMenuItems.map((item) => (
                <div key={item.id}>
                  {item.submenu ? (
                    <div className="relative group">
                      <button
                        onClick={() => toggleSubmenu(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleSubmenu(item.id)
                          }
                        }}
                        className={`group flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors
                          ${activeSubmenu === item.id || isSubmenuActive(item.submenu)
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                          }`}
                        aria-expanded={activeSubmenu === item.id}
                        aria-label={item.name}
                      >
                        <span className={`${isSidebarCollapsed ? 'mx-auto' : 'mr-3'} shrink-0`}>
                          {item.icon}
                        </span>
                        {!isSidebarCollapsed && (
                          <>
                            <span className="flex-1 text-left">{item.name}</span>
                            {activeSubmenu === item.id ? (
                              <ChevronDown size={16} className="text-gray-400" />
                            ) : (
                              <ChevronRight size={16} className="text-gray-400" />
                            )}
                          </>
                        )}
                      </button>

                      {isSidebarCollapsed && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-sm rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          {item.name}
                        </div>
                      )}

                      {activeSubmenu === item.id && !isSidebarCollapsed && (
                        <div className="mt-1 ml-4 space-y-1">
                          {item.submenu.map((subItem) => (
                            <Link
                              key={subItem.id}
                              to={subItem.href || '#'}
                              onClick={() => setIsSidebarOpen(false)}
                              className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                                ${isActiveMenu(subItem.href)
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                                }`}
                            >
                              <span className="mr-3 shrink-0">{subItem.icon}</span>
                              {subItem.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link
                      to={item.href || '#'}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors
                        ${isActiveMenu(item.href)
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                    >
                      <span className={`${isSidebarCollapsed ? 'mx-auto' : 'mr-3'} shrink-0`}>
                        {item.icon}
                      </span>
                      {!isSidebarCollapsed && item.name}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </nav>
        </div>

        {/* Overlay for mobile */}
        {isSidebarOpen && (
          <div 
            ref={overlayRef}
            className="fixed inset-0 bg-gray-900 bg-opacity-50 z-20 lg:hidden transition-opacity duration-200"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Main content */}
        <main className="flex-1 overflow-auto pb-16 lg:pb-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
