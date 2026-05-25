import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { useAuthStore } from "@/features/auth"
import { useToast } from "@/contexts/ToastContext"
import { parseApiError } from "@/lib/errorParser"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { UserPlus, Eye, EyeOff } from "lucide-react"

export default function RegisterPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [employeeId, setEmployeeId] = useState("")
  const { register, isLoading } = useAuthStore()
  const { success, error } = useToast()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      error("Password tidak cocok")
      return
    }
    try {
      await register(email, password, employeeId)
      success("Registrasi berhasil")
      setTimeout(() => navigate("/login"), 2000)
    } catch (err: unknown) {
      error(parseApiError(err, "Gagal mendaftar"))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-b from-[#2D1B1B] via-[#1E1215] to-[#1A1018] px-4 py-12">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-20 mx-auto rounded-lg bg-[#C53030] flex flex-col items-center justify-center shadow-lg mb-4 gap-1.5 border-[5px] border-[#D4A843]">
            <span className="text-base font-black text-white leading-none">S</span>
            <span className="text-base font-black text-white leading-none">I</span>
            <span className="text-base font-black text-white leading-none">S</span>
          </div>
          <h2 className="text-xl text-gray-100" style={{ fontFamily: "'Gang of Three', sans-serif" }}>S U S H I M A S</h2>
          <p className="text-xs text-[#D4A843] mt-1 tracking-widest uppercase">Internal System V.2</p>
        </div>

        <div className="bg-[#1E1215]/80 backdrop-blur-sm p-8 rounded-2xl shadow-lg border border-[#D4A843]/20">
          <h2 className="text-2xl font-semibold text-white">Daftar Akun</h2>
          <p className="text-gray-400 text-sm mt-1">Buat akun baru untuk akses sistem</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="employeeId" className="text-sm text-gray-300">Employee ID</label>
              <input
                id="employeeId" type="text" required placeholder="EMP-12345"
                value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 bg-[#1A1018] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C53030]/50 focus:border-[#C53030] transition-all"
              />
            </div>
            <div>
              <label htmlFor="email" className="text-sm text-gray-300">Email</label>
              <input
                id="email" type="email" required placeholder="nama@perusahaan.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full mt-1 px-4 py-2.5 bg-[#1A1018] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C53030]/50 focus:border-[#C53030] transition-all"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-sm text-gray-300">Password</label>
              <div className="relative">
                <input
                  id="password" type={showPassword ? "text" : "password"} required placeholder="Minimal 8 karakter"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 pr-10 bg-[#1A1018] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C53030]/50 focus:border-[#C53030] transition-all"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5 text-gray-500 hover:text-gray-300">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="text-sm text-gray-300">Konfirmasi Password</label>
              <input
                id="confirmPassword" type={showPassword ? "text" : "password"} required placeholder="Ulangi password"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full mt-1 px-4 py-2.5 bg-[#1A1018] border rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C53030]/50 focus:border-[#C53030] transition-all ${confirmPassword && confirmPassword !== password ? 'border-red-500' : 'border-gray-700'}`}
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="text-xs text-red-400 mt-1">Password tidak cocok</p>
              )}
            </div>

            <button type="submit" disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#C53030] hover:bg-[#B52828] text-white rounded-lg font-semibold text-sm transition-all disabled:opacity-50 shadow-lg shadow-red-900/30 active:scale-[0.98]">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Mendaftar...
                </span>
              ) : (
                <><UserPlus size={16} /> Daftar</>
              )}
            </button>

            <div className="text-center pt-2">
              <span className="text-sm text-gray-500">Sudah punya akun? </span>
              <Link to="/login" className="text-sm font-medium text-[#D4A843] hover:text-[#E4B853] transition-colors">
                Masuk di sini
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
