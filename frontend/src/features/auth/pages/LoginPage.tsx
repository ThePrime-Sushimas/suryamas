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
    <div className="min-h-screen flex">
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-linear-to-b from-[#2D1B1B] via-[#1E1215] to-[#1A1018] text-white relative items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07] bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-size-[24px_24px]" />
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[#C53030]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-[#C53030]/5 rounded-full blur-3xl" />

        <div className="relative z-10 text-center px-12 max-w-md">
          <div className="w-16 h-28 mx-auto rounded-xl bg-[#C53030] flex flex-col items-center justify-center shadow-2xl shadow-red-900/30 mb-8 gap-2.5 border-6 border-[#D4A843]">
            <span className="text-xl font-black text-white leading-none">S</span>
            <span className="text-xl font-black text-white leading-none">I</span>
            <span className="text-xl font-black text-white leading-none">S</span>
          </div>

          <h1 className="text-7xl tracking-tight" style={{ fontFamily: "'Gang of Three', sans-serif" }}>
            SUSHIMAS
          </h1>
          <p className="text-sm font-medium text-[#D4A843] mt-2 tracking-widest uppercase">Internal System V.2</p>

          <p className="mt-10 text-3xl tracking-[0.3em] text-white-500 font-light">
            努力は報われる
          </p>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center bg-linear-to-b from-[#2D1B1B] via-[#231418] to-[#1A1018] px-6 py-12 border-l border-[#D4A843]/20">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-10 h-20 mx-auto rounded-lg bg-[#C53030] flex flex-col items-center justify-center shadow-lg mb-4 gap-1.5 border-5 border-[#D4A843]">
              <span className="text-base font-black text-white leading-none">S</span>
              <span className="text-base font-black text-white leading-none">I</span>
              <span className="text-base font-black text-white leading-none">S</span>
            </div>
            <h2 className="text-xl text-gray-100 dark:text-white" style={{ fontFamily: "'Gang of Three', sans-serif" }}>S U S H I M AS</h2>
            <p className="text-xs text-yellow-200 dark:text-gray-400 mt-1">Internal System V.2</p>
          </div>

          <div className={`relative bg-[#1E1215]/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-[#D4A843]/20 transition-all ${isLoading ? 'pointer-events-none' : ''}`}>
            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-[#1E1215]/70 backdrop-blur-sm rounded-2xl z-10 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <span className="w-8 h-8 border-3 border-red-200 border-t-[#C53030] rounded-full animate-spin" />
                  <span className="text-xs text-gray-400">Memverifikasi...</span>
                </div>
              </div>
            )}

            <h2 className="text-2xl font-semibold text-white">Masuk</h2>
            <p className="text-gray-400 text-sm mt-1">Akses sistem operasional Sushimas</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="email" className="text-sm text-gray-300">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="nama@perusahaan.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 bg-[#1A1018] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C53030]/50 focus:border-[#C53030] transition-all"
                />
              </div>

              <div>
                <label htmlFor="password" className="text-sm text-gray-300">Password</label>
                <div className="relative mt-1">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-11 bg-[#1A1018] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C53030]/50 focus:border-[#C53030] transition-all"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword((v) => !v)}
                    title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
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
                  className="w-3.5 h-3.5 rounded border-gray-600 text-[#C53030] focus:ring-[#C53030]/50 bg-[#1A1018]"
                />
                <span className="text-sm text-gray-400">Ingat saya</span>
              </label>

              <button
                type="submit"
                disabled={isLoading || !isValid}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-white font-medium bg-linear-to-r from-[#C53030] to-[#1A1F2B] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#C53030] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Memproses...
                  </div>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Masuk
                  </>
                )}
              </button>
            </form>

            <div className="flex justify-between mt-5 text-sm text-gray-500">
              <Link to="/forgot-password" className="hover:text-[#D4A843] transition-colors">
                Lupa password?
              </Link>
              <Link to="/register" className="hover:text-[#D4A843] transition-colors">
                Daftar
              </Link>
            </div>
          </div>

          <p className="text-center text-[10px] text-gray-600 mt-6">
            © {new Date().getFullYear()} PT Surya Mas Pratama. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
