import { useState, useEffect, useRef, useMemo } from "react";
import { useLocation, Link, Outlet, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Key,
  Package,
  Factory,
  Warehouse,
  Users,
  Settings,
  LogOut,
  Search,
  User,
  ShoppingCart,
  Building2,
  UserCog,
  Shield,
  DollarSign,
  Calculator,
  FileSpreadsheet,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { useAuthStore } from "@/features/auth";
import { BranchSwitcher, usePermissionStore } from "@/features/branch_context";
import { UploadProgressToast } from "@/features/pos-imports/components/UploadProgressToast";
import { JobNotificationBell } from "@/features/jobs";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface MenuItem {
  id: string;
  name: string;
  href?: string;
  icon: React.ReactNode;
  submenu?: MenuItem[];
  disabled?: boolean;
  badge?: number;
  module?: string;
}

// Komponen MenuItem dengan dukungan nested submenu
const MenuItemComponent = ({ item, level, onNavigate }: { item: MenuItem; level: number; onNavigate?: () => void }) => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  
  const isActive = item.href === location.pathname;
  const hasSubmenu = item.submenu && item.submenu.length > 0;

  // Auto open submenu jika ada child yang aktif
  useEffect(() => {
    if (hasSubmenu) {
      const isChildActive = item.submenu?.some((subItem) => {
        if (subItem.href === location.pathname) return true;
        if (subItem.submenu) {
          return subItem.submenu.some((nestedItem) => nestedItem.href === location.pathname);
        }
        return false;
      });
      if (isChildActive) {
        setIsOpen(true);
      }
    }
  }, [location.pathname, item.submenu, hasSubmenu]);

  const toggleSubmenu = () => {
    setIsOpen(!isOpen);
  };

  const handleClick = () => {
    if (hasSubmenu) {
      toggleSubmenu();
    }
    // Tutup sidebar mobile saat navigasi
    if (onNavigate) {
      onNavigate();
    }
  };

  // Styling berdasarkan level
  const paddingLeft = level === 0 ? 'px-3' : level === 1 ? 'ml-4 px-3' : 'ml-8 px-3';
  const activeClass = isActive 
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" 
    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700";
  const parentActiveClass = hasSubmenu && item.submenu?.some((sub) => 
    sub.href === location.pathname || sub.submenu?.some((nested) => nested.href === location.pathname)
  ) 
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
    : activeClass;

  if (hasSubmenu) {
    return (
      <div className="relative group">
        <button
          onClick={handleClick}
          className={`group flex items-center w-full py-2 text-sm font-medium rounded-md transition-colors ${paddingLeft} ${parentActiveClass}`}
          aria-expanded={isOpen}
        >
          <span className={`${level === 0 ? "mr-3" : "mr-3"} shrink-0`}>
            {item.icon}
          </span>
          <span className="flex-1 text-left">{item.name}</span>
          {isOpen ? (
            <ChevronDown size={16} className="text-gray-400" />
          ) : (
            <ChevronRight size={16} className="text-gray-400" />
          )}
        </button>

        {isOpen && (
          <div className="mt-1 space-y-1">
            {item.submenu?.map((subItem) => (
              <MenuItemComponent 
                key={subItem.id} 
                item={subItem} 
                level={level + 1}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to={item.href || "#"}
      onClick={handleClick}
      className={`group flex items-center py-2 text-sm font-medium rounded-md transition-colors ${paddingLeft} ${activeClass}`}
    >
      <span className={`${level === 0 ? "mr-3" : "mr-3"} shrink-0`}>
        {item.icon}
      </span>
      {item.name}
    </Link>
  );
};

export default function Layout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { permissions, isLoaded } = usePermissionStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const menuItems: MenuItem[] = useMemo(
    () => [
      {
        id: "dashboard",
        name: "Dashboard",
        href: "/",
        icon: <LayoutDashboard size={18} />,
      },
      {
        id: "master-data",
        name: "Master Data",
        icon: <Package size={18} />,
        submenu: [
          {
            id: "companies",
            name: "Companies",
            href: "/companies",
            icon: <Factory size={16} />,
            module: "companies",
          },
          {
            id: "branches",
            name: "Branches",
            href: "/branches",
            icon: <Warehouse size={16} />,
            module: "branches",
          },
          {
            id: "categories",
            name: "Categories",
            href: "/categories",
            icon: <Package size={16} />,
            module: "categories",
          },
          {
            id: "sub-categories",
            name: "Sub Categories",
            href: "/sub-categories",
            icon: <Package size={16} />,
            module: "sub_categories",
          },
          {
            id: "metric-units",
            name: "Metric Units",
            href: "/metric-units",
            icon: <Package size={16} />,
            module: "metric_units",
          },
          {
            id: "payment-terms",
            name: "Payment Terms",
            href: "/payment-terms",
            icon: <Package size={16} />,
            module: "payment_terms",
          },
          {
            id: "payment-methods",
            name: "Payment Methods",
            href: "/payment-methods",
            icon: <DollarSign size={16} />,
            module: "payment_methods",
          },
        ],
      },
      {
        id: "products",
        name: "Products",
        icon: <ShoppingCart size={18} />,
        submenu: [
          {
            id: "products",
            name: "Products",
            href: "/products",
            icon: <Package size={16} />,
            module: "products",
          },
          {
            id: "suppliers",
            name: "Suppliers",
            href: "/suppliers",
            icon: <Building2 size={16} />,
            module: "suppliers",
          },
          {
            id: "supplier-products",
            name: "Supplier Products",
            href: "/supplier-products",
            icon: <ShoppingCart size={16} />,
            module: "supplier_products",
          },
          {
            id: "pricelists",
            name: "Pricelists",
            href: "/pricelists",
            icon: <DollarSign size={16} />,
            module: "pricelists",
          },
        ],
      },
      {
        id: "accounting",
        name: "Accounting",
        icon: <Calculator size={18} />,
        submenu: [
          // Core Accounting
          {
            id: "accounting-core",
            name: "Core Accounting",
            icon: <Calculator size={16} />,
            submenu: [
              {
                id: "chart-of-accounts",
                name: "Chart of Accounts",
                href: "/chart-of-accounts",
                icon: <Calculator size={16} />,
                module: "chart_of_accounts",
              },
              {
                id: "accounting-purposes",
                name: "Accounting Purposes",
                href: "/accounting-purposes",
                icon: <Calculator size={16} />,
                module: "accounting_purposes",
              },
              {
                id: "accounting-purpose-accounts",
                name: "Purpose Accounts",
                href: "/accounting-purpose-accounts",
                icon: <Calculator size={16} />,
                module: "accounting_purpose_accounts",
              },
            ],
          },
          // Period & Journals
          {
            id: "accounting-periods",
            name: "Period & Journals",
            icon: <Calculator size={16} />,
            submenu: [
              {
                id: "fiscal-periods",
                name: "Fiscal Periods",
                href: "/accounting/fiscal-periods",
                icon: <Calculator size={16} />,
                module: "fiscal_periods",
              },
              {
                id: "journal-entries",
                name: "Journal Entries",
                href: "/accounting/journals",
                icon: <Calculator size={16} />,
                module: "journals",
              },
            ],
          },
          // POS Management
          {
            id: "accounting-pos",
            name: "POS Management",
            icon: <FileSpreadsheet size={16} />,
            submenu: [
              {
                id: "pos-imports",
                name: "POS Imports",
                href: "/pos-imports",
                icon: <FileSpreadsheet size={16} />,
                module: "pos_imports",
              },
              {
                id: "pos-transactions",
                name: "POS Transactions",
                href: "/pos-transactions",
                icon: <FileSpreadsheet size={16} />,
                module: "pos_imports",
              },
              {
                id: "pos-aggregates",
                name: "POS Aggregates",
                href: "/pos-aggregates",
                icon: <FileSpreadsheet size={16} />,
                module: "pos_aggregates",
              },
              {
                id: "failed-transactions",
                name: "Failed Transactions",
                href: "/pos-aggregates/failed-transactions",
                icon: <AlertTriangle size={16} />,
                module: "pos_aggregates",
              },
            ],
          },
          // Banking
          {
            id: "accounting-banking",
            name: "Banking",
            icon: <ShieldCheck size={16} />,
            submenu: [
              {
                id: "bank-statement-imports",
                name: "Bank Statement Imports",
                href: "/bank-statement-import",
                icon: <FileSpreadsheet size={16} />,
                module: "bank_statement_imports",
              },
              {
                id: "bank-reconciliation",
                name: "Bank Reconciliation",
                href: "/bank-reconciliation",
                icon: <ShieldCheck size={16} />,
                module: "bank_reconciliation",
              },
              {
                id: "settlement-groups",
                name: "Settlement Groups",
                href: "/bank-reconciliation/settlement-groups",
                icon: <FileSpreadsheet size={16} />,
                module: "bank_reconciliation",
              },
            ],
          },
        ],
      },
      {
        id: "hr",
        name: "Human Resources",
        icon: <Users size={18} />,
        submenu: [
          {
            id: "employees",
            name: "Employees",
            href: "/employees",
            icon: <Users size={16} />,
            module: "employees",
          },
          {
            id: "employee_branches",
            name: "Employee Branches",
            href: "/employee-branches",
            icon: <Building2 size={16} />,
            module: "employee_branches",
          },
        ],
      },
      {
        id: "settings",
        name: "Settings",
        icon: <Settings size={18} />,
        submenu: [
          {
            id: "users",
            name: "Users",
            href: "/users",
            icon: <UserCog size={16} />,
            module: "users",
          },
          {
            id: "permissions",
            name: "Permissions",
            href: "/permissions",
            icon: <Shield size={16} />,
            module: "permissions",
          },
        ],
      },
    ],
    [],
  );

  const filteredMenuItems = useMemo(() => {
    if (!isLoaded) return menuItems;

    const filterMenu = (items: MenuItem[]): MenuItem[] => {
      return items
        .map((item) => {
          if (item.submenu) {
            const filteredSubmenu = filterMenu(item.submenu);
            return { ...item, submenu: filteredSubmenu };
          }
          return item;
        })
        .filter((item) => {
          if (item.submenu) return item.submenu.length > 0;
          if (item.module) return permissions[item.module]?.view === true;
          return true;
        });
    };

    return filterMenu(menuItems);
  }, [menuItems, permissions, isLoaded]);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const userInitial = user?.full_name?.charAt(0).toUpperCase() || "U";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-black">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
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
                aria-label={
                  isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                }
              >
                <Menu size={20} />
              </button>
              <Link to="/" className="flex items-center">
                <div className="h-10 w-10 bg-linear-to-br from-(--color-primary-gradient-start)items-center justify-center text-white font-bold mr-3">
                  SIS
                </div>
                <div className="hidden sm:block">
                  <div className="text-xl font-bold text-gray-800 dark:text-white">
                    Sushimas
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
                    Internal System V.2
                  </div>
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
              <ThemeToggle />
              <JobNotificationBell />

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
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${isProfileOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {user?.full_name || "User"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {user?.email || "user@example.com"}
                      </p>
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
                        setIsProfileOpen(false);
                        handleLogout();
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
            ${isSidebarOpen ? "translate-x-0 shadow-xl" : "-translate-x-full"}
            ${isSidebarCollapsed ? "lg:w-16" : "lg:w-64"}
            w-64
          `}
        >
          <nav className="mt-8 px-4 h-[calc(100vh-8rem)] overflow-y-auto">
            <div className="space-y-1">
              {filteredMenuItems.map((item) => (
                <MenuItemComponent 
                  key={item.id} 
                  item={item} 
                  level={0}
                  onNavigate={() => setIsSidebarOpen(false)}
                />
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

      {/* Global Upload Progress Toast */}
      <UploadProgressToast />
    </div>
  );
}
