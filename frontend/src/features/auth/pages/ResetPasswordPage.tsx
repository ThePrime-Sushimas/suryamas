import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import api from '@/lib/axios'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Lock, ArrowLeft, AlertTriangle } from 'lucide-react'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [isInvalidAccess, setIsInvalidAccess] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { success } = useToast()

  const cleanHash = location.hash.replace(/\s+/g, '')
  const searchParams = new URLSearchParams(cleanHash.substring(1))
  const recoveryToken = searchParams.get('access_token') || searchParams.get('recovery_token')

  useEffect(() => {
    if (!recoveryToken) setIsInvalidAccess(true)
    else setShowForm(true)
  }, [recoveryToken])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) { setError('Password tidak cocok'); return }
    if (password.length < 6) { setError('Password minimal 6 karakter'); return }

    setIsLoading(true)
    try {
      await api.post('/auth/reset-password',
        { password, recovery_token: recoveryToken },
        { headers: { 'x-supabase-recovery-token': recoveryToken || '' } }
      )
      success('Password berhasil diperbarui!')
      navigate('/login')
    } catch (err: unknown) {
      setError(parseApiError(err, 'Gagal mereset password'))
    } finally {
      setIsLoading(false)
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
          {isInvalidAccess ? (
            <div className="text-center py-4">
              <AlertTriangle className="w-12 h-12 text-[#D4A843] mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Akses Tidak Valid</h2>
              <p className="text-gray-400 text-sm mb-6">
                Reset password hanya bisa diakses melalui link yang dikirim ke email. Silakan request ulang.
              </p>
              <div className="flex flex-col gap-3">
                <Link to="/forgot-password"
                  className="w-full py-2.5 bg-[#C53030] hover:bg-[#B52828] text-white rounded-lg font-semibold text-sm transition-all text-center shadow-lg shadow-red-900/30">
                  Request Reset Password
                </Link>
                <Link to="/login"
                  className="inline-flex items-center justify-center gap-1 text-sm font-medium text-[#D4A843] hover:text-[#E4B853] transition-colors">
                  <ArrowLeft size={14} /> Kembali ke Login
                </Link>
              </div>
            </div>
          ) : !showForm ? (
            <div className="flex items-center justify-center py-8">
              <span className="w-6 h-6 border-2 border-gray-600 border-t-[#D4A843] rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-white">Reset Password</h2>
              <p className="text-gray-400 text-sm mt-1">Masukkan password baru</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">{error}</div>
                )}
                <div>
                  <label htmlFor="password" className="text-sm text-gray-300">Password Baru</label>
                  <input
                    id="password" type="password" required placeholder="••••••••"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 bg-[#1A1018] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C53030]/50 focus:border-[#C53030] transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="text-sm text-gray-300">Konfirmasi Password</label>
                  <input
                    id="confirmPassword" type="password" required placeholder="••••••••"
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 bg-[#1A1018] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C53030]/50 focus:border-[#C53030] transition-all"
                  />
                </div>

                <button type="submit" disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#C53030] hover:bg-[#B52828] text-white rounded-lg font-semibold text-sm transition-all disabled:opacity-50 shadow-lg shadow-red-900/30 active:scale-[0.98]">
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Memperbarui...
                    </span>
                  ) : (
                    <><Lock size={16} /> Perbarui Password</>
                  )}
                </button>

                <div className="text-center pt-2">
                  <Link to="/login" className="inline-flex items-center gap-1 text-sm font-medium text-[#D4A843] hover:text-[#E4B853] transition-colors">
                    <ArrowLeft size={14} /> Kembali ke Login
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
