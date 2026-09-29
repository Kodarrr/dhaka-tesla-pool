'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'
import { useState, useEffect } from 'react'
import { apiGetSystemConditions, type SystemConditions } from '@/lib/api'
import { Zap, LogOut, LogIn, UserPlus, Loader2, ShieldAlert, CloudRain, Car } from 'lucide-react'
import AuthModal from '@/components/auth-modal'
import { useDriverStatus } from '@/lib/use-driver-status'

function CityConditionBadge() {
  const [conditions, setConditions] = useState<SystemConditions | null>(null)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const data = await apiGetSystemConditions()
        if (mounted) setConditions(data)
      } catch {
        // ignore
      }
    }
    load()

    const onConditionChanged = (e: Event) => {
      const custom = e as CustomEvent<SystemConditions>
      if (custom.detail) setConditions(custom.detail)
      else load()
    }
    window.addEventListener('dtp-conditions-changed', onConditionChanged)
    const interval = setInterval(load, 15000)
    return () => {
      mounted = false
      window.removeEventListener('dtp-conditions-changed', onConditionChanged)
      clearInterval(interval)
    }
  }, [])

  if (!conditions || (!conditions.isTrafficJam && !conditions.isRaining)) {
    return null
  }

  const isBoth = conditions.isTrafficJam && conditions.isRaining

  return (
    <div
      className={cn(
        'hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border shadow-sm transition-all animate-fadeIn',
        isBoth
          ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
          : conditions.isTrafficJam
          ? 'bg-orange-500/15 border-orange-500/35 text-orange-300'
          : 'bg-blue-500/15 border-blue-500/35 text-blue-300'
      )}
      title={`Live City Surge Active: Effective rate is ৳${conditions.effectivePerKmRateBDT}/km`}
    >
      {conditions.isTrafficJam && <Car className="w-3.5 h-3.5 shrink-0" />}
      {conditions.isRaining && <CloudRain className="w-3.5 h-3.5 shrink-0" />}
      <span>
        {isBoth
          ? 'Traffic & Rain Surge (+40%)'
          : conditions.isTrafficJam
          ? 'Traffic Jam (+20%)'
          : 'Monsoon Rain (+20%)'}
      </span>
    </div>
  )
}

function DriverStatusToggle() {
  const { isOnline, loading, toggleOnline } = useDriverStatus()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOnline}
      disabled={loading}
      onClick={() => toggleOnline()}
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-200 cursor-pointer shadow-sm',
        isOnline
          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
          : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:bg-zinc-800'
      )}
      title={isOnline ? 'You are Online (Click to go Offline)' : 'You are Offline (Click to go Online)'}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
      ) : (
        <span
          className={cn(
            'w-2 h-2 rounded-full transition-all duration-300',
            isOnline ? 'bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]' : 'bg-zinc-500'
          )}
        />
      )}
      <span className="font-semibold">
        {isOnline ? 'Online' : 'Offline'}
      </span>
      <span
        className={cn(
          'w-7 h-4 rounded-full p-0.5 border flex items-center transition-colors',
          isOnline ? 'bg-emerald-500/40 border-emerald-400 justify-end' : 'bg-zinc-700 border-zinc-600 justify-start'
        )}
      >
        <span className={cn('w-2.5 h-2.5 rounded-full shadow-sm', isOnline ? 'bg-emerald-400' : 'bg-zinc-400')} />
      </span>
    </button>
  )
}

export default function Navbar() {
  const { user, isAuthenticated, logout, openAuthModal, closeAuthModal, authModal, role } = useAuth()
  const isAdmin = role === 'ADMIN'
  const isDriver = role === 'DRIVER'
  const isPassenger = !isAdmin && !isDriver

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50">
      <div className="bg-dhaka-night/85 backdrop-blur-xl border-b border-dhaka-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
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

            <CityConditionBadge />
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <>
                {user.role === 'DRIVER' && <DriverStatusToggle />}
                <Link
                  href="/profile"
                  className="flex items-center gap-2.5 min-w-0 group hover:opacity-90 transition-opacity cursor-pointer"
                  title="View your profile & settings"
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ring-1 ring-transparent group-hover:ring-blue-400/40 transition-all text-white',
                      isAdmin
                        ? 'bg-amber-600'
                        : isDriver
                        ? 'bg-emerald-600'
                        : 'bg-blue-600'
                    )}
                  >
                    {isAdmin ? <ShieldAlert className="w-3.5 h-3.5 text-white" /> : user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-xs text-dhaka-text-headline font-medium max-w-[140px] truncate group-hover:text-blue-300 transition-colors">
                    {user.name}
                  </span>
                  <span
                    className={cn(
                      'text-[11px] font-medium px-2 py-0.5 rounded-full border',
                      isAdmin
                        ? 'text-amber-300 bg-amber-500/10 border-amber-500/25'
                        : isDriver
                        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/25'
                        : 'text-blue-300 bg-blue-500/10 border-blue-500/25'
                    )}
                  >
                    {isAdmin ? 'Admin' : isDriver ? 'Driver' : 'Passenger'}
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
