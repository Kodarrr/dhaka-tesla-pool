'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { Zap, LogOut, LogIn, UserPlus } from 'lucide-react'
import AuthModal from '@/components/auth-modal'

export default function Navbar() {
  const { user, isAuthenticated, logout, openAuthModal, closeAuthModal, authModal, role } = useAuth()
  const isPassenger = role !== 'DRIVER'

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50">
      <div className="bg-[#0f1521]/70 backdrop-blur-xl border-b border-[#1f2d44]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 hover:opacity-90 transition-opacity">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #00ff9d)' }}
            >
              <Zap className="w-4 h-4 text-[#090d16]" strokeWidth={2.5} />
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-[#f0f4ff] tracking-tight">Dhaka</span>
              <span className="font-bold bg-gradient-to-r from-[#00d4ff] to-[#00ff9d] bg-clip-text text-transparent ml-1">Tesla Pool</span>
            </div>
            <span className="sm:hidden font-bold bg-gradient-to-r from-[#00d4ff] to-[#00ff9d] bg-clip-text text-transparent text-sm">DTP</span>
          </Link>

          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-2 min-w-0 group hover:opacity-90 transition-opacity cursor-pointer"
                  title="View your profile & history"
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ring-1 ring-transparent group-hover:ring-[#00d4ff]/40 transition-all',
                      isPassenger
                        ? 'bg-gradient-to-br from-cyan-500 to-blue-600'
                        : 'bg-gradient-to-br from-green-500 to-emerald-600'
                    )}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-sm text-[#f0f4ff] font-medium max-w-[140px] truncate group-hover:text-[#00d4ff] transition-colors">
                    {user.name}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                      isPassenger
                        ? 'text-[#00d4ff] bg-[#00d4ff]/10 border-[#00d4ff]/30'
                        : 'text-[#00ff9d] bg-[#00ff9d]/10 border-[#00ff9d]/30'
                    )}
                  >
                    {user.role}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="btn-secondary px-3 py-2 text-xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Log Out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="btn-secondary px-3 py-2 text-xs"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal('signup')}
                  className="btn-primary px-3 py-2 text-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className={cn(
          'h-0.5 w-full transition-all duration-500',
          isPassenger
            ? 'bg-gradient-to-r from-transparent via-[#00d4ff] to-transparent'
            : 'bg-gradient-to-r from-transparent via-[#00ff9d] to-transparent'
        )}
      />
      </header>
      {authModal && (
        <AuthModal
          mode={authModal}
          onClose={closeAuthModal}
          onSwitchMode={openAuthModal}
        />
      )}
    </>
  )
}
