'use client'

import { useState, FormEvent } from 'react'
import { useAuth, type UserRole, type AuthModalMode } from '@/lib/auth-context'
import { X, Loader2, LogIn, UserPlus } from 'lucide-react'

interface AuthModalProps {
  mode: AuthModalMode
  onClose: () => void
  onSwitchMode: (mode: AuthModalMode) => void
}

export default function AuthModal({ mode, onClose, onSwitchMode }: AuthModalProps) {
  const { login, signup } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('PASSENGER')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isLogin = mode === 'login'

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (isLogin) {
        await login(email.trim(), password)
      } else {
        await signup(name.trim(), email.trim(), password, role)
      }
    } catch (err: unknown) {
      const ae = err as { response?: { data?: { message?: string }; status?: number } }
      const status = ae.response?.status
      const message = ae.response?.data?.message
      if (status === 401) setError('Invalid email or password')
      else if (status === 409) setError('An account with this email already exists')
      else setError(message ?? (isLogin ? 'Login failed' : 'Sign up failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass-card p-6 animate-slide-up">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#4d6080] hover:text-[#f0f4ff] transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-lg font-bold text-[#f0f4ff] mb-1">
          {isLogin ? 'Log in' : 'Create an account'}
        </h2>
        <p className="text-xs text-[#4d6080] mb-5">
          {isLogin
            ? 'Use your account email and password.'
            : 'Sign up to book Tesla pool rides or drive.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-xs text-[#8ba3c7] font-medium">Name</label>
              <input
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs text-[#8ba3c7] font-medium">Email</label>
            <input
              className="input-field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-[#8ba3c7] font-medium">Password</label>
            <input
              className="input-field"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </div>

          {!isLogin && (
            <div className="space-y-1.5">
              <label className="text-xs text-[#8ba3c7] font-medium">Role</label>
              <div className="flex gap-2">
                {(['PASSENGER', 'DRIVER', 'ADMIN'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      role === r
                        ? r === 'ADMIN'
                          ? 'border-amber-400/70 text-amber-300 bg-amber-500/10'
                          : 'border-[#00d4ff]/70 text-[#00d4ff] bg-[#00d4ff]/10'
                        : 'border-[#1f2d44]/50 text-[#4d6080] hover:text-[#8ba3c7]'
                    }`}
                  >
                    {r === 'ADMIN' ? 'Admin' : r === 'DRIVER' ? 'Driver' : 'Passenger'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {isLogin ? 'Log in' : 'Sign up'}
          </button>
        </form>

        {/* Demo Cast One-Click Login */}
        <div className="mt-5 pt-4 border-t border-[#1f2d44]/50">
          <div className="text-[11px] font-semibold text-[#8ba3c7] mb-2.5 flex items-center justify-between">
            <span>Demo 1-Click Login</span>
            <span className="text-[10px] text-[#4d6080]">password123</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '👑 Admin (Controls)', email: 'admin@gmail.com', border: 'border-amber-500/30 hover:bg-amber-500/10 text-amber-300' },
              { label: '👤 Nusrat (Passenger)', email: 'nusrat@gmail.com', border: 'border-blue-500/30 hover:bg-blue-500/10 text-blue-300' },
              { label: '👤 Rafiq (Passenger)', email: 'rafiq@gmail.com', border: 'border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-300' },
              { label: '🚗 Jashim (Driver)', email: 'jashim@gmail.com', border: 'border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-300' },
            ].map(({ label, email: demoEmail, border }) => (
              <button
                key={demoEmail}
                type="button"
                disabled={submitting}
                onClick={async () => {
                  setError('')
                  setSubmitting(true)
                  try {
                    await login(demoEmail, 'password123')
                  } catch (err: unknown) {
                    const ae = err as { response?: { data?: { message?: string } } }
                    setError(ae.response?.data?.message || 'Login failed')
                  } finally {
                    setSubmitting(false)
                  }
                }}
                className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium text-left truncate transition-all ${border}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-[#4d6080] text-center mt-4">
          {isLogin ? (
            <>
              No account?{' '}
              <button type="button" className="text-[#00d4ff] font-semibold" onClick={() => onSwitchMode('signup')}>
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" className="text-[#00d4ff] font-semibold" onClick={() => onSwitchMode('login')}>
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
