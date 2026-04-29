import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "@/features/auth";
import { useToast } from "@/contexts/ToastContext";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Eye, EyeOff, LogIn } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const { login, isLoading } = useAuthStore();
  const { success, error } = useToast();
  const navigate = useNavigate();

  const isValid = email.includes("@") && password.length >= 6;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    try {
      await login(email, password, remember);
      success("Login berhasil");
      navigate("/");
    } catch {
      error("Email atau password salah");
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-rose-50 via-sky-50 to-violet-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 transition-colors duration-500">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100/60 via-violet-100/40 to-rose-100/60 dark:from-blue-900/20 dark:via-violet-900/10 dark:to-rose-900/20" />
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-200/40 dark:bg-blue-800/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-violet-200/40 dark:bg-violet-800/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-rose-200/30 dark:bg-rose-800/10 rounded-full blur-3xl" />

        <div className="relative z-10 text-center px-12 max-w-lg">
          <div className="w-24 h-24 bg-white dark:bg-gray-800 rounded-3xl mx-auto flex items-center justify-center shadow-xl shadow-blue-100/50 dark:shadow-none mb-8 border border-white/60 dark:border-gray-700">
            <span className="text-3xl font-black bg-gradient-to-br from-blue-600 to-violet-600 bg-clip-text text-transparent">SIS</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4 tracking-tight">
            Sushimas
            <span className="block text-lg font-medium text-gray-500 dark:text-gray-400 mt-1 tracking-normal">Internal System</span>
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 leading-relaxed mt-6">
            Platform terpadu untuk mengelola operasional restoran, keuangan, dan sumber daya manusia.
          </p>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-[fadeIn_0.4s_ease-out]">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 bg-white dark:bg-gray-800 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-100/50 dark:shadow-none border border-white/60 dark:border-gray-700 mb-4">
              <span className="text-xl font-black bg-gradient-to-br from-blue-600 to-violet-600 bg-clip-text text-transparent">SIS</span>
            </div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white">Sushimas Internal System</h2>
          </div>

          <div className={`relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-2xl shadow-xl shadow-gray-200/50 dark:shadow-none border border-white/80 dark:border-gray-700 p-8 transition-all ${isLoading ? 'pointer-events-none' : ''}`}>
            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl z-10 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <span className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                  <span className="text-xs text-gray-500 dark:text-gray-400">Memverifikasi...</span>
                </div>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Masuk</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Masukkan email dan password Anda</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="nama@perusahaan.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full px-4 py-3 bg-gray-50/80 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1.5 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full px-4 py-3 pr-11 bg-gray-50/80 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-all"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  tabIndex={-1}
                  className="w-3.5 h-3.5 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-400/50"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">Ingat saya</span>
              </label>

              <button
                type="submit"
                disabled={isLoading || !isValid}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-violet-500 hover:from-blue-600 hover:to-violet-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-200/50 dark:shadow-none active:scale-[0.98]"
              >
                <LogIn className="w-4 h-4" />
                Masuk
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between">
              <Link
                to="/forgot-password"
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
              >
                Lupa password?
              </Link>
              <Link
                to="/register"
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Belum punya akun? <span className="font-semibold text-blue-500 dark:text-blue-400">Daftar</span>
              </Link>
            </div>
          </div>

          <p className="text-center text-[10px] text-gray-400 dark:text-gray-600 mt-6">
            © {new Date().getFullYear()} PT Surya Mas Pratama. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
