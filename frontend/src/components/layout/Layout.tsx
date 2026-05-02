import { useState, useRef } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  Key,
  LogOut,
  Search,
  User,
  ChevronDown,
} from "lucide-react";
import { useAuthStore } from "@/features/auth";
import { BranchSwitcher } from "@/features/branch_context";
import { useBranchAccess } from "@/features/branch_context/hooks/useBranchAccess";
import { useBranchContextStore } from "@/features/branch_context/store/branchContext.store";
import { UploadProgressToast } from "@/features/pos-imports/components/UploadProgressToast";
import { JobNotificationBell } from "@/features/jobs";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Sidebar } from "./Sidebar";

function ReadOnlyBanner() {
  const { isClosed } = useBranchAccess()
  const currentBranch = useBranchContextStore(s => s.currentBranch)
  if (!isClosed) return null
  return (
    <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
      <span>⚠️</span>
      <span>
        Cabang <strong>{currentBranch?.branch_name}</strong> sudah tutup permanen. Hanya bisa melihat data historis.
      </span>
    </div>
  )
}

export default function Layout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  const sidebarRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const toggleSidebar = () => setIsSidebarOpen((prev) => !prev);
  const toggleCollapse = () => setIsSidebarCollapsed((prev) => !prev);
  const toggleProfile = () => setIsProfileOpen((prev) => !prev);

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
                onClick={toggleSidebar}
                className="mr-2 p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 lg:hidden"
                aria-label={isSidebarOpen ? "Close menu" : "Open menu"}
              >
                {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
              <button
                onClick={toggleCollapse}
                className="hidden lg:block mr-2 p-2 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                aria-label={
                  isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                }
              >
                <Menu size={20} />
              </button>
              <Link to="/" className="flex items-center">
                <div className="h-10 w-7 bg-[#C53030] rounded-lg flex flex-col items-center justify-center mr-3 gap-0 border border-[#D4A843]/30">
                  <span className="text-[10px] font-black text-white leading-none">S</span>
                  <span className="text-[10px] font-black text-white leading-none">I</span>
                  <span className="text-[10px] font-black text-white leading-none">S</span>
                </div>
                <div className="hidden sm:block">
                  <div className="text-xl text-red-700 dark:text-white" style={{ fontFamily: "'Gang of Three', sans-serif" }}>
                    SUSHIMAS
                  </div>
                  <div className="text-xs text-red-700 dark:text-yellow-400 -mt-1">
                    Internal System V.2
                  </div>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 md:gap-4 min-w-0">
              <BranchSwitcher />
              <button
                className="hidden sm:block p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                aria-label="Search"
              >
                <Search size={20} />
              </button>
              <ThemeToggle />
              <JobNotificationBell />

              {/* Profile Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={toggleProfile}
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

      <div className="flex flex-1 overflow-hidden h-[calc(100vh-4rem)]">
        <Sidebar
          isOpen={isSidebarOpen}
          isCollapsed={isSidebarCollapsed}
          onNavigate={() => setIsSidebarOpen(false)}
          sidebarRef={sidebarRef}
        />

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
          <ReadOnlyBanner />
          <Outlet />
        </main>
      </div>

      {/* Global Upload Progress Toast */}
      <UploadProgressToast />
    </div>
  );
}
