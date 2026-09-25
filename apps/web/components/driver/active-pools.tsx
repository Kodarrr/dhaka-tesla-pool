'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import {
  apiGetActiveRides,
  apiDriverAccept,
  apiDriverArrived,
  apiDriverArriveAtDestination,
  apiDriverComplete,
  apiGetUserProfile,
  apiDriverConfirmCash,
} from '@/lib/api'

import { cn, formatBDT, formatDate, ZONE_EMOJI } from '@/lib/utils'
import type { ActivePool } from '@/lib/api'
import StarRating from '@/components/ui/star-rating'
import { UserNameBadge } from '@/components/ui/user-profile-card'
import {
  RefreshCw,
  ChevronRight,
  Car,
  Clock,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Route,
  Navigation,
  Activity,
  Wifi,
} from 'lucide-react'

// ── DriverRatingSummary: shown in the header for the logged-in driver ─────────
function DriverRatingSummary({ driverId }: { driverId: string }) {
  const [avgRating, setAvgRating] = useState<number | null>(null)
  const [reviewCount, setReviewCount] = useState(0)

  useEffect(() => {
    if (!driverId) return
    apiGetUserProfile(driverId)
      .then((p) => {
        if (p.role === 'DRIVER') {
          setAvgRating(p.averageRating)
          setReviewCount(p.reviewCount)
        }
      })
      .catch(() => {/* silent */})
  }, [driverId])

  return (
    <div className="mt-2">
      <StarRating rating={avgRating} reviewCount={reviewCount} size="sm" />
    </div>
  )
}

export default function ActivePools() {
  const { isAuthenticated, user } = useAuth()
  const [pools, setPools] = useState<ActivePool[]>([])
  const [stats, setStats] = useState({ poolsCount: 0, requestsCount: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastRefresh, setLast] = useState<Date | null>(null)
  const [actionStates, setActions] = useState<Record<string, { doing: boolean; done: string }>>({})

  const fetchActive = useCallback(async () => {
    if (!isAuthenticated) return
    setLoading(true)
    setError('')
    try {
      const data = await apiGetActiveRides()
      setPools(data.activePools)
      setStats({ poolsCount: data.activePoolsCount, requestsCount: data.activeRequestsCount })
      setLast(new Date())
    } catch {
      setError('Could not load active pools — backend may be offline.')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setPools([])
      return
    }
    fetchActive()
    const interval = setInterval(fetchActive, 5_000)
    return () => clearInterval(interval)
  }, [fetchActive, isAuthenticated])

  const runAction = useCallback(
    async (targetId: string, label: string, fn: () => Promise<unknown>) => {
      setActions((prev) => ({ ...prev, [targetId]: { doing: true, done: '' } }))
      try {
        await fn()
        setActions((prev) => ({ ...prev, [targetId]: { doing: false, done: label } }))
        // Refresh immediately and again after brief delay
        fetchActive()
        setTimeout(fetchActive, 1000)
      } catch (err: unknown) {
        const ae = err as { response?: { data?: { error?: string } } }
        setError(ae.response?.data?.error ?? `Failed to ${label.toLowerCase()}.`)
        setActions((prev) => ({ ...prev, [targetId]: { doing: false, done: '' } }))
      }
    },
    [fetchActive]
  )



  const totalEarnings = pools.reduce(
    (sum, p) => sum + p.rideRequests.reduce((s, r) => s + Math.round(r.totalFarePaisa / 100), 0),
    0
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
              {/* Change 8: driver sees their own average rating in header */}
              {user?.id && <DriverRatingSummary driverId={user.id} />}
            </div>
          </div>
          <div className="relative w-12 h-6 bg-[#00ff9d]/20 border border-[#00ff9d]/40 rounded-full cursor-pointer">
            <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#00ff9d] shadow-sm" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Active Pools', value: stats.poolsCount.toString(), color: 'text-[#00d4ff]' },
            { label: 'Pending Riders', value: stats.requestsCount.toString(), color: 'text-[#00ff9d]' },
            { label: 'Pool Earnings', value: totalEarnings > 0 ? formatBDT(totalEarnings) : '—', color: 'text-[#f0f4ff]' },
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
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
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
            const earnings = pool.rideRequests.reduce(
              (s, r) => s + Math.round(r.totalFarePaisa / 100),
              0
            )
            const action = actionStates[pool.id]
            const isMatched = pool.stage === 'MATCHED'
            const isArrived = pool.stage === 'DRIVER_ARRIVED'
            const isRequested = pool.stage === 'REQUESTED'
            const isInProgress = pool.stage === 'IN_PROGRESS'
            const isArrivedAtDestination = pool.stage === 'ARRIVED_AT_DESTINATION'
            const isCompleted = pool.stage === 'COMPLETED'

            const activeRiders = pool.rideRequests.filter((r) => r.stage !== 'CANCELLED')
            const sortedRiders = [...activeRiders].sort((a, b) => {
              const legsA = a.fareBreakdown?.legs?.length ?? 0
              const legsB = b.fareBreakdown?.legs?.length ?? 0
              return legsA - legsB
            })

            const completedRiders = sortedRiders.filter((r) => r.stage === 'COMPLETED')
            const allCompleted = sortedRiders.length > 0 && completedRiders.length === sortedRiders.length

            const corridorName = sortedRiders[0]?.fareBreakdown?.corridorName

            return (
              <div key={pool.id} className="glass-card p-5 border-l-2 border-l-[#00ff9d]/60">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-bold text-[#f0f4ff]">
                      <MapPin className="w-4 h-4 text-[#00ff9d] shrink-0" />
                      <span>{ZONE_EMOJI[pool.pickupZone] ?? '📍'} {pool.pickupZone}</span>
                      <span className="text-[#4d6080] font-normal text-xs">pickup zone</span>
                    </div>
                    {corridorName && (
                      <div className="flex items-center gap-1 text-xs text-[#00d4ff] mt-1 font-medium">
                        <Route className="w-3 h-3" />
                        {corridorName}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-[#4d6080] mt-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(pool.createdAt)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-[#00ff9d]">
                      {earnings > 0 ? formatBDT(earnings) : '—'}
                    </div>
                    <div className="text-xs text-[#4d6080]">total earnings</div>
                  </div>
                </div>

                {/* Seat fill */}
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-[#4d6080] mb-1.5">
                    <div className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {pool.seatsTaken} / {pool.seatsCap} seats filled
                    </div>
                    <span>{Math.round((pool.seatsTaken / pool.seatsCap) * 100)}%</span>
                  </div>
                  <div className="w-full bg-[#1c2740] rounded-full overflow-hidden h-2">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(pool.seatsTaken / pool.seatsCap) * 100}%`,
                        background: 'linear-gradient(90deg, #00d4ff, #00ff9d)',
                      }}
                    />
                  </div>
                </div>

                {/* Riders List */}
                {sortedRiders.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-[#4d6080] uppercase tracking-wider flex items-center gap-1.5">
                        <Navigation className="w-3 h-3 text-[#00ff9d]" />
                        Passengers &amp; Drop-off Stops
                      </p>
                      <span
                        className={cn(
                          'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                          allCompleted
                            ? 'bg-[#00ff9d]/20 text-[#00ff9d] border-[#00ff9d]/30'
                            : 'bg-[#00d4ff]/20 text-[#00d4ff] border-[#00d4ff]/30'
                        )}
                      >
                        {allCompleted ? 'All journeys ended' : `${completedRiders.length}/${sortedRiders.length} reached stop`}
                      </span>
                    </div>

                    {sortedRiders.map((req, stopIdx) => {
                      const fareBDT = Math.round(req.totalFarePaisa / 100)
                      const isPassengerCompleted = req.stage === 'COMPLETED'

                      return (
                        <div
                          key={req.id}
                          className={cn(
                            'glass-card-sm p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-l-2',
                            isPassengerCompleted ? 'border-l-[#00ff9d]/60 opacity-80' : 'border-l-[#00d4ff]/80'
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#f0f4ff]">
                              <span className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                                {stopIdx + 1}
                              </span>
                              <UserNameBadge
                                userId={req.passenger.id}
                                name={req.passenger.name}
                                className="truncate text-xs"
                              />
                              <span className="text-[10px] text-[#00ff9d] bg-[#00ff9d]/10 px-1.5 py-0.5 rounded border border-[#00ff9d]/20">
                                Stop #{stopIdx + 1}
                              </span>
                              {isPassengerCompleted ? (
                                <span className="text-[10px] font-bold text-[#00ff9d] bg-[#00ff9d]/15 px-2 py-0.5 rounded border border-[#00ff9d]/30 flex items-center gap-1">
                                  Left Vehicle · Paid {req.paymentMethod === 'CASH' ? 'Cash' : 'TeslaPay'} ✅
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-[#00d4ff] bg-[#00d4ff]/15 px-2 py-0.5 rounded border border-[#00d4ff]/30 flex items-center gap-1">
                                  Onboard 🚗 · Pay on exit ({req.paymentMethod === 'CASH' ? 'Cash' : 'TeslaPay'})
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-[#8ba3c7] mt-1.5 ml-7">
                              <span className="font-semibold text-[#f0f4ff]">
                                Drop-off: {ZONE_EMOJI[req.destinationZone] ?? '📍'} {req.destinationZone}
                              </span>
                              <ChevronRight className="w-3 h-3 text-[#4d6080]" />
                              <span className="text-[#4d6080] flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {req.seats} seat{req.seats > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs font-bold text-[#00d4ff]">
                              {formatBDT(fareBDT)}
                            </div>
                            <div className="text-[10px] text-[#00ff9d]">Prepaid</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Action buttons */}
                <div className="space-y-2">
                  {action?.done ? (
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00ff9d]/10 border border-[#00ff9d]/30 text-[#00ff9d] text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      {action.done === 'Accept' && 'Pool Accepted! Driver en route.'}
                      {action.done === 'Arrived' && 'Marked Arrived at Pickup!'}
                      {action.done === 'Complete' && 'Journey Completed!'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* Accept — only available when REQUESTED */}
                      {isRequested && (
                        <button
                          onClick={() => runAction(pool.id, 'Accept', () => apiDriverAccept(pool.id))}
                          disabled={action?.doing}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border border-[#00d4ff]/40 text-[#00d4ff] bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                        >
                          {action?.doing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          Accept Pool
                        </button>
                      )}

                      {/* Mark Arrived at Pickup — only when MATCHED */}
                      {isMatched && (
                        <button
                          onClick={() => runAction(pool.id, 'Arrived', () => apiDriverArrived(pool.id))}
                          disabled={action?.doing}
                          className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border border-[#00d4ff]/40 text-[#00d4ff] bg-[#00d4ff]/10 hover:bg-[#00d4ff]/20 transition-all duration-200 disabled:opacity-50 cursor-pointer"
                        >
                          {action?.doing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                          Mark Arrived at Pickup
                        </button>
                      )}

                      {/* Status & actions when in progress / arrived */}
                      {(isArrived || isInProgress || isArrivedAtDestination) && (
                        <div className="space-y-2">
                          {allCompleted ? (
                            <div className="p-3.5 rounded-xl bg-[#00ff9d]/15 border border-[#00ff9d]/30 text-center space-y-1 animate-fade-in">
                              <p className="text-xs font-bold text-[#00ff9d] flex items-center justify-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" />
                                All passengers have ended their journey! Trip completed automatically.
                              </p>
                              <p className="text-[11px] text-[#8ba3c7]">
                                Earnings have been credited to your TeslaPay wallet.
                              </p>
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl bg-[#0a0e17]/50 border border-[#1f2d44]/50 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 text-[#8ba3c7]">
                                <Car className="w-4 h-4 text-[#00d4ff] animate-pulse" />
                                <span>Trip in progress · Passengers leave at their stop</span>
                              </div>
                              <button
                                onClick={() => runAction(pool.id, 'Complete', () => apiDriverComplete(pool.id))}
                                disabled={action?.doing}
                                className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 underline cursor-pointer disabled:opacity-50"
                              >
                                {action?.doing ? 'Finishing…' : 'Drop Off All & Finish'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
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

