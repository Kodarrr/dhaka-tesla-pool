'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiGetMyRides } from '@/lib/api'
import { cn, formatBDT, formatDate, STAGE_META, ZONE_EMOJI } from '@/lib/utils'
import type { RideRequest } from '@/lib/api'
import { RefreshCw, ChevronRight, Car, Clock, Users, Loader2, Inbox, AlertCircle, Wifi } from 'lucide-react'

export default function MyRides() {
  const { isAuthenticated, openAuthModal } = useAuth()
  const [rides, setRides]         = useState<RideRequest[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [lastRefresh, setLast]    = useState<Date | null>(null)

  const fetchRides = useCallback(async () => {
    if (!isAuthenticated) return
    setLoading(true); setError('')
    try {
      const data = await apiGetMyRides()
      setRides(data); setLast(new Date())
    } catch {
      setError('Could not load rides — backend may be offline or you need to log in first.')
    } finally { setLoading(false) }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setRides([])
      return
    }
    fetchRides()
    const interval = setInterval(fetchRides, 30_000)
    return () => clearInterval(interval)
  }, [fetchRides, isAuthenticated])

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-[#00d4ff]" />
          <h2 className="text-sm font-semibold text-[#f0f4ff] uppercase tracking-wider">My Ride Requests</h2>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#4d6080]">
              <Wifi className="w-3 h-3 text-[#00ff9d]" />
              {lastRefresh.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          <button onClick={fetchRides} disabled={loading}
            className="btn-secondary px-3 py-2 text-xs">
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
        </div>
      )}

      {/* Skeleton */}
      {loading && rides.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1c2740] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#1c2740] rounded w-3/4" />
                  <div className="h-3 bg-[#1c2740] rounded w-1/2" />
                </div>
                <div className="h-5 w-20 bg-[#1c2740] rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && rides.length === 0 && (
        <div className="glass-card p-10 text-center">
          <Inbox className="w-10 h-10 text-[#4d6080] mx-auto mb-3" />
          {isAuthenticated ? (
            <>
              <p className="text-[#8ba3c7] font-medium">No rides yet</p>
              <p className="text-sm text-[#4d6080] mt-1">Use the Fare Estimator to book your first Tesla Pool ride</p>
            </>
          ) : (
            <>
              <p className="text-[#8ba3c7] font-medium">Log in to see your rides</p>
              <button type="button" onClick={() => openAuthModal('login')} className="btn-primary mt-4 px-4 py-2 text-xs">
                Login
              </button>
            </>
          )}
        </div>
      )}

      {rides.length > 0 && (
        <div className="space-y-3">
          {rides.map((ride) => {
            const meta = STAGE_META[ride.stage] ?? STAGE_META.REQUESTED
            const fareBDT = Math.round(ride.totalFarePaisa / 100)
            return (
              <div key={ride.id} className="glass-card p-4 hover:border-[#1f2d44]/70 transition-colors duration-200">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#f0f4ff] min-w-0">
                    <span>{ZONE_EMOJI[ride.pickupZone]} {ride.pickupZone}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#4d6080] shrink-0" />
                    <span className="truncate">{ZONE_EMOJI[ride.destinationZone]} {ride.destinationZone}</span>
                  </div>
                  <div className={cn('status-badge shrink-0', meta.color, meta.bg)}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {meta.label}
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#4d6080]">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{ride.seats} seat{ride.seats > 1 ? 's' : ''}</span>
                  <span className="flex items-center gap-1 text-[#00d4ff] font-semibold">{formatBDT(fareBDT)}</span>
                  {ride.pool?.tesla && (
                    <span className="flex items-center gap-1 text-[#00ff9d]">
                      <Car className="w-3 h-3" />{ride.pool.tesla.name} · {ride.pool.tesla.plate}
                    </span>
                  )}
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(ride.createdAt)}</span>
                </div>

                {ride.pool && (
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    <div className="flex-1 bg-[#1c2740] rounded-full overflow-hidden h-1.5">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${(ride.pool.seatsTaken / ride.pool.seatsCap) * 100}%`,
                          background: 'linear-gradient(90deg, #00d4ff, #00ff9d)',
                        }} />
                    </div>
                    <span className="text-[#4d6080] whitespace-nowrap">
                      {ride.pool.seatsTaken}/{ride.pool.seatsCap} seats
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {rides.length > 0 && (
        <p className="text-center text-xs text-[#4d6080]">
          {rides.length} ride{rides.length !== 1 ? 's' : ''} total · auto-refreshes every 30s
        </p>
      )}
    </div>
  )
}
