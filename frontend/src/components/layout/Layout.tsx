import { useState, useEffect, useRef, useMemo } from 'react'
import { useLocation, Link, Outlet } from 'react-router-dom'
import { Menu, X, ChevronDown, ChevronRight, LayoutDashboard, Package, Factory, Warehouse, Users, Settings, LogOut, Bell, Search } from 'lucide-react'

interface MenuItem {
  id: string
  name: string
  href?: string
  icon: React.ReactNode
  submenu?: MenuItem[]
}

export default function Layout() {
  const location = useLocation()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

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
        { id: 'categories', name: 'Categories', href: '/categories', icon: <Package size={16} /> },
        { id: 'sub-categories', name: 'Sub Categories', href: '/sub-categories', icon: <Package size={16} /> },
        { id: 'companies', name: 'Companies', href: '/companies', icon: <Factory size={16} /> },
        { id: 'branches', name: 'Branches', href: '/branches', icon: <Warehouse size={16} /> },
      ]
    },
    {
      id: 'employees',
      name: 'Employees',
      href: '/employees',
      icon: <Users size={18} />
    },
    {
      id: 'users',
      name: 'Users',
      href: '/users',
      icon: <Users size={18} />
    },
    {
      id: 'permissions',
      name: 'Permissions',
      href: '/permissions',
      icon: <Settings size={18} />
    },
  ], [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node) && window.innerWidth < 1024) {
        setIsSidebarOpen(false)
      }
    }
    
    if (isSidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSidebarOpen])

  const toggleSubmenu = (menuId: string) => {
    setActiveSubmenu(activeSubmenu === menuId ? null : menuId)
  }

  const isActiveMenu = (href?: string) => {
    return href === location.pathname
  }

  const isSubmenuActive = (submenu?: MenuItem[]) => {
    return submenu?.some(item => isActiveMenu(item.href))
  }

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
              >
                {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="hidden lg:block mr-2 p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <Menu size={20} />
              </button>
              <Link to="/" className="flex items-center">
                <div className="h-10 w-10 bg-gradient-to-br from-blue-600 to-blue-800 rounded-xl flex items-center justify-center text-white font-bold mr-3">
                  SIS
                </div>
                <div className="hidden sm:block">
                  <div className="text-xl font-bold text-gray-800 dark:text-white">Sushimas</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 -mt-1">System</div>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-4">
              <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400">
                <Search size={20} />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 relative">
                <Bell size={20} />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div 
          ref={sidebarRef}
          className={`
            fixed inset-y-0 left-0 z-30 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-all duration-300 ease-in-out lg:static lg:translate-x-0 lg:shadow-none
            ${isSidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}
            ${isSidebarCollapsed ? 'lg:w-16' : 'lg:w-64'}
            w-64
          `}
        >
          <nav className="mt-8 px-4 h-[calc(100vh-8rem)] overflow-y-auto">
            <div className="space-y-1">
              {menuItems.map((item) => (
                <div key={item.id}>
                  {item.submenu ? (
                    <div className="relative group">
                      <button
                        onClick={() => toggleSubmenu(item.id)}
                        className={`group flex items-center w-full px-3 py-2 text-sm font-medium rounded-md transition-colors
                          ${activeSubmenu === item.id || isSubmenuActive(item.submenu)
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                          }`}
                      >
                        <span className={`${isSidebarCollapsed ? 'mx-auto' : 'mr-3'} flex-shrink-0`}>
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
                              <span className="mr-3 flex-shrink-0">{subItem.icon}</span>
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
                      <span className={`${isSidebarCollapsed ? 'mx-auto' : 'mr-3'} flex-shrink-0`}>
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
            className="fixed inset-0 bg-gray-900 bg-opacity-50 z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
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
