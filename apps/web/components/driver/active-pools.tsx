'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiGetActiveRides } from '@/lib/api'
import { cn, formatBDT, formatDate, ZONE_EMOJI } from '@/lib/utils'
import type { ActivePool } from '@/lib/api'
import {
  RefreshCw, ChevronRight, Car, Clock, Users, Loader2, AlertCircle,
  CheckCircle2, PlayCircle, StopCircle, Activity, Wifi, MapPin,
} from 'lucide-react'

export default function ActivePools() {
  const { isAuthenticated } = useAuth()
  const [pools, setPools]           = useState<ActivePool[]>([])
  const [stats, setStats]           = useState({ poolsCount: 0, requestsCount: 0 })
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [lastRefresh, setLast]      = useState<Date | null>(null)
  const [actionStates, setActions]  = useState<Record<string, string>>({})

  const fetchActive = useCallback(async () => {
    if (!isAuthenticated) return
    setLoading(true); setError('')
    try {
      const data = await apiGetActiveRides()
      setPools(data.activePools)
      setStats({ poolsCount: data.activePoolsCount, requestsCount: data.activeRequestsCount })
      setLast(new Date())
    } catch { setError('Could not load active pools — backend may be offline.') }
    finally { setLoading(false) }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setPools([])
      return
    }
    fetchActive()
    const interval = setInterval(fetchActive, 15_000)
    return () => clearInterval(interval)
  }, [fetchActive, isAuthenticated])

  const handleAction = useCallback((poolId: string, action: string) => {
    setActions((prev) => ({ ...prev, [poolId]: action }))
    setTimeout(() => {
      setActions((prev) => ({ ...prev, [poolId]: `${action}_done` }))
    }, 1200)
  }, [])

  const totalEarnings = pools.reduce(
    (sum, p) => sum + p.rideRequests.reduce((s, r) => s + Math.round(r.totalFarePaisa / 100), 0), 0
  )

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Driver status header */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00ff9d]/20 border border-[#00ff9d]/30 flex items-center justify-center">
              <Car className="w-5 h-5 text-[#00ff9d]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#f0f4ff]">Driver Dashboard</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="dot-online" />
                <span className="text-xs text-[#00ff9d] font-medium">Online · Accepting Passengers</span>
              </div>
            </div>
          </div>
          {/* Toggle visual */}
          <div className="relative w-12 h-6 bg-[#00ff9d]/20 border border-[#00ff9d]/40 rounded-full cursor-pointer">
            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#00ff9d] shadow-sm" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Active Pools',   value: stats.poolsCount.toString(),  color: 'text-[#00d4ff]' },
            { label: 'Pending Riders', value: stats.requestsCount.toString(), color: 'text-[#00ff9d]' },
            { label: 'Pool Earnings',  value: totalEarnings > 0 ? formatBDT(totalEarnings) : '—', color: 'text-[#f0f4ff]' },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center py-2 px-3 rounded-xl bg-[#1c2740]/60 border border-[#1f2d44]/30">
              <p className={cn('text-xl font-bold', color)}>{value}</p>
              <p className="text-xs text-[#4d6080] mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feed header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#00ff9d]" />
          <h3 className="text-sm font-semibold text-[#f0f4ff] uppercase tracking-wider">Active Route Pools</h3>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#4d6080]">
              <Wifi className="w-3 h-3 text-[#00ff9d]" />
              {lastRefresh.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          <button onClick={fetchActive} disabled={loading} className="btn-secondary px-3 py-2 text-xs">
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
      {loading && pools.length === 0 && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="glass-card p-5 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#1c2740] shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#1c2740] rounded w-2/3" />
                  <div className="h-3 bg-[#1c2740] rounded w-1/2" />
                  <div className="h-3 bg-[#1c2740] rounded w-3/4" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && pools.length === 0 && (
        <div className="glass-card p-10 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#1c2740]/60 border border-[#1f2d44]/40 flex items-center justify-center mx-auto mb-3">
            <Car className="w-6 h-6 text-[#4d6080]" />
          </div>
          <p className="text-[#8ba3c7] font-medium">No active pools right now</p>
          <p className="text-sm text-[#4d6080] mt-1">Passenger requests will appear here automatically</p>
          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#4d6080]">
            <RefreshCw className="w-3 h-3" />Auto-refreshes every 15s
          </div>
        </div>
      )}

      {/* Pools feed */}
      {pools.length > 0 && (
        <div className="space-y-4">
          {pools.map((pool) => {
            const earnings    = pool.rideRequests.reduce((s, r) => s + Math.round(r.totalFarePaisa / 100), 0)
            const actionState = actionStates[pool.id]

            return (
              <div key={pool.id} className="glass-card p-5 border-l-2 border-l-[#00ff9d]/60">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-[#f0f4ff]">
                      <MapPin className="w-4 h-4 text-[#00ff9d] shrink-0" />
                      <span>{ZONE_EMOJI[pool.pickupZone as string] ?? '📍'} {pool.pickupZone}</span>
                      <span className="text-[#4d6080] font-normal text-xs">pickup zone</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#4d6080] mt-1">
                      <Clock className="w-3 h-3" />{formatDate(pool.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#00ff9d]">{earnings > 0 ? formatBDT(earnings) : '—'}</div>
                    <div className="text-xs text-[#4d6080]">total earnings</div>
                  </div>
                </div>

                {/* Seat fill */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-[#4d6080] mb-1.5">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />{pool.seatsTaken} / {pool.seatsCap} seats filled
                    </div>
                    <span>{Math.round((pool.seatsTaken / pool.seatsCap) * 100)}%</span>
                  </div>
                  <div className="w-full bg-[#1c2740] rounded-full overflow-hidden h-2">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(pool.seatsTaken / pool.seatsCap) * 100}%`,
                        background: 'linear-gradient(90deg, #00d4ff, #00ff9d)',
                      }} />
                  </div>
                </div>

                {/* Riders */}
                {pool.rideRequests.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-xs font-semibold text-[#4d6080] uppercase tracking-wider">Riders</p>
                    {pool.rideRequests.map((req) => (
                      <div key={req.id} className="glass-card-sm p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-xs font-semibold text-[#f0f4ff]">
                            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                              {req.passenger.name.charAt(0)}
                            </div>
                            <span className="truncate">{req.passenger.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[#4d6080] mt-1 ml-7">
                            <span>{ZONE_EMOJI[req.destinationZone as string] ?? '📍'} {req.destinationZone}</span>
                            <ChevronRight className="w-3 h-3" />
                            <Users className="w-3 h-3" />
                            <span>{req.seats} seat{req.seats > 1 ? 's' : ''}</span>
                          </div>
                        </div>
                        <div className="text-xs font-bold text-[#00d4ff] shrink-0">
                          {formatBDT(Math.round(req.totalFarePaisa / 100))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {actionState?.endsWith('_done') ? (
                    <div className="col-span-3 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00ff9d]/10 border border-[#00ff9d]/30 text-[#00ff9d] text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      {actionState === 'accept_done'   && 'Pool Accepted!'}
                      {actionState === 'start_done'    && 'Ride Started!'}
                      {actionState === 'complete_done' && 'Ride Completed!'}
                    </div>
                  ) : (
                    <>
                      <button onClick={() => handleAction(pool.id, 'accept')} disabled={actionState === 'accept'}
                        className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border border-[#00d4ff]/40 text-[#00d4ff] bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 transition-all duration-200 disabled:opacity-50">
                        {actionState === 'accept' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Accept
                      </button>
                      <button onClick={() => handleAction(pool.id, 'start')} disabled={actionState === 'start'}
                        className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border border-[#00ff9d]/40 text-[#00ff9d] bg-[#00ff9d]/10 hover:bg-[#00ff9d]/20 transition-all duration-200 disabled:opacity-50">
                        {actionState === 'start' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                        Start
                      </button>
                      <button onClick={() => handleAction(pool.id, 'complete')} disabled={actionState === 'complete'}
                        className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border border-[#1f2d44]/50 text-[#8ba3c7] hover:border-[#1f2d44] hover:text-[#f0f4ff] bg-[#1c2740]/40 transition-all duration-200 disabled:opacity-50">
                        {actionState === 'complete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <StopCircle className="w-3.5 h-3.5" />}
                        Complete
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {pools.length > 0 && (
        <p className="text-center text-xs text-[#4d6080]">
          {pools.length} active pool{pools.length !== 1 ? 's' : ''} · auto-refreshes every 15s
        </p>
      )}
    </div>
  )
}
