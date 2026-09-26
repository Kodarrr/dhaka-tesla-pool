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
      <div className="bg-dhaka-night/85 backdrop-blur-xl border-b border-dhaka-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 shrink-0 hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-dhaka-cobalt text-white shadow-dhaka-cta">
              <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <div className="hidden sm:block">
              <span className="font-bold text-dhaka-text-headline tracking-tight text-base">Dhaka</span>
              <span className="font-semibold text-blue-400 ml-1.5 text-base">Tesla Pool</span>
            </div>
            <span className="sm:hidden font-bold text-blue-400 text-sm">DTP</span>
          </Link>

          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <>
                <Link
                  href="/profile"
                  className="flex items-center gap-2.5 min-w-0 group hover:opacity-90 transition-opacity cursor-pointer"
                  title="View your profile & history"
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ring-1 ring-transparent group-hover:ring-blue-400/40 transition-all text-white',
                      isPassenger
                        ? 'bg-blue-600'
                        : 'bg-emerald-600'
                    )}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-xs text-dhaka-text-headline font-medium max-w-[140px] truncate group-hover:text-blue-300 transition-colors">
                    {user.name}
                  </span>
                  <span
                    className={cn(
                      'text-[11px] font-medium px-2 py-0.5 rounded-full border',
                      isPassenger
                        ? 'text-blue-300 bg-blue-500/10 border-blue-500/25'
                        : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
                    )}
                  >
                    {user.role === 'DRIVER' ? 'Driver' : 'Passenger'}
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="btn-secondary px-3 py-1.5 text-xs font-medium"
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
                  className="btn-secondary px-3 py-1.5 text-xs font-medium"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => openAuthModal('signup')}
                  className="btn-primary px-3.5 py-1.5 text-xs font-medium shadow-none"
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
          'h-[1px] w-full transition-all duration-500',
          isPassenger
            ? 'bg-gradient-to-r from-transparent via-blue-500/40 to-transparent'
            : 'bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent'
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
