import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/axios'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const toast = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await api.post('/auth/forgot-password', { email })
      setSuccess(true)
      toast.success('Email reset password berhasil dikirim')
    } catch (err: unknown) {
      toast.error(parseApiError(err, 'Gagal mengirim email reset'))
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
          {success ? (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">Email Terkirim</h2>
              <p className="text-gray-400 text-sm mb-6">
                Cek inbox <span className="text-white font-medium">{email}</span> untuk instruksi reset password.
              </p>
              <Link to="/login"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#D4A843] hover:text-[#E4B853] transition-colors">
                <ArrowLeft size={14} /> Kembali ke Login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-white">Lupa Password</h2>
              <p className="text-gray-400 text-sm mt-1">Masukkan email untuk menerima link reset</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="email" className="text-sm text-gray-300">Email</label>
                  <input
                    id="email" type="email" required autoFocus placeholder="nama@perusahaan.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full mt-1 px-4 py-2.5 bg-[#1A1018] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#C53030]/50 focus:border-[#C53030] transition-all"
                  />
                </div>

                <button type="submit" disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#C53030] hover:bg-[#B52828] text-white rounded-lg font-semibold text-sm transition-all disabled:opacity-50 shadow-lg shadow-red-900/30 active:scale-[0.98]">
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Mengirim...
                    </span>
                  ) : (
                    <><Mail size={16} /> Kirim Link Reset</>
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
