'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiGetMyRides, apiCancelRide, apiSubmitReview, apiGetUserProfile } from '@/lib/api'
import { cn, formatBDT, formatDate, STAGE_META, ZONE_EMOJI } from '@/lib/utils'
import type { RideRequest, DriverProfile } from '@/lib/api'
import StarRating from '@/components/ui/star-rating'
import { UserNameBadge } from '@/components/ui/user-profile-card'
import {
  RefreshCw,
  ChevronRight,
  Car,
  Clock,
  Users,
  Loader2,
  Inbox,
  AlertCircle,
  Wifi,
  Route,
  Tag,
  XCircle,
  Layers,
  Star,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react'

// ── DriverInfoBadge ─────────────────────────────────────────────────────────

function DriverInfoBadge({
  driverId,
  driverName,
  teslaInfo,
}: {
  driverId: string
  driverName: string
  teslaInfo?: string
}) {
  const [profile, setProfile] = useState<DriverProfile | null>(null)

  useEffect(() => {
    if (!driverId) return
    apiGetUserProfile(driverId)
      .then((p) => {
        if (p.role === 'DRIVER') setProfile(p)
      })
      .catch(() => {})
  }, [driverId])

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs py-1 px-2.5 rounded-lg bg-[#0a0e17]/50 border border-[#1f2d44]/40">
      <Car className="w-3.5 h-3.5 text-[#00ff9d]" />
      <span className="text-[#4d6080]">Driver:</span>
      <UserNameBadge userId={driverId} name={driverName} className="font-semibold text-[#f0f4ff]" />
      {profile && (
        <StarRating rating={profile.averageRating} reviewCount={profile.reviewCount} size="sm" />
      )}
      {teslaInfo && <span className="text-[#4d6080]">({teslaInfo})</span>}
    </div>
  )
}

// ── ReviewPrompt ─────────────────────────────────────────────────────────────

interface ReviewPromptProps {
  rideId: string
  driverName: string
  onDone: (rating: number, comment?: string) => void
}

function ReviewPrompt({ rideId, driverName, onDone }: ReviewPromptProps) {
  const [selected, setSelected] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState<number | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!selected) return
    setSubmitting(true)
    setError('')
    try {
      await apiSubmitReview(rideId, { rating: selected, comment: comment || undefined })
      setSubmitted(selected)
      setTimeout(() => onDone(selected, comment || undefined), 1500)
    } catch (err: unknown) {
      const ae = err as { response?: { data?: { error?: string } } }
      setError(ae.response?.data?.error ?? 'Failed to submit review.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted !== null) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#00ff9d]/10 border border-[#00ff9d]/30 animate-fade-in">
        <CheckCircle2 className="w-4 h-4 text-[#00ff9d] shrink-0" />
        <p className="text-xs font-semibold text-[#00ff9d]">
          Thanks! Your {submitted}★ review was submitted.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-[#1f2d44]/40 space-y-3">
      <div className="flex items-center gap-2">
        <Star className="w-3.5 h-3.5 text-amber-400" />
        <p className="text-xs font-semibold text-[#8ba3c7]">
          Rate your driver <span className="text-[#f0f4ff] font-semibold">{driverName}</span>
        </p>
      </div>

      {/* Star input */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setSelected(n)}
            className="text-2xl transition-colors duration-100 leading-none"
            aria-label={`${n} star`}
          >
            <span
              className={cn(
                n <= (hover || selected) ? 'text-amber-400' : 'text-[#2a3650]'
              )}
            >
              ★
            </span>
          </button>
        ))}
        {(hover || selected) > 0 && (
          <span className="ml-2 text-xs text-amber-400 font-semibold self-center">
            {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][hover || selected]}
          </span>
        )}
      </div>

      {/* Optional comment */}
      <div className="relative">
        <MessageSquare className="absolute left-2.5 top-2.5 w-3 h-3 text-[#4d6080] pointer-events-none" />
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 300))}
          placeholder="Optional comment… (max 300 chars)"
          rows={2}
          className="w-full bg-[#0a0e17]/60 border border-[#1f2d44]/50 rounded-xl py-2 pl-8 pr-3 text-xs text-[#f0f4ff] placeholder-[#4d6080] focus:outline-none focus:border-[#00d4ff]/50 focus:ring-1 focus:ring-[#00d4ff]/20 resize-none transition-all"
        />
        <span className="absolute right-2.5 bottom-2 text-[10px] text-[#4d6080]">
          {comment.length}/300
        </span>
      </div>

      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!selected || submitting}
        className="btn-primary w-full py-2.5 text-sm disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Star className="w-4 h-4" />
        )}
        Submit Review
      </button>
    </div>
  )
}

// ── MyRides (main export) ─────────────────────────────────────────────────────

export default function MyRides() {
  const { isAuthenticated, openAuthModal } = useAuth()
  const [rides, setRides] = useState<RideRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [lastRefresh, setLast] = useState<Date | null>(null)
  const [expandedLegs, setExpandedLegs] = useState<Record<string, boolean>>({})
  const [localReviews, setLocalReviews] = useState<Record<string, { rating: number; comment?: string }>>({})

  const fetchRides = useCallback(async () => {
    if (!isAuthenticated) return
    setLoading(true)
    setError('')
    try {
      const data = await apiGetMyRides()
      setRides(data)
      setLast(new Date())
    } catch {
      setError('Could not load rides — backend may be offline or you need to log in first.')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setRides([])
      return
    }
    fetchRides()
    const interval = setInterval(fetchRides, 15_000)
    return () => clearInterval(interval)
  }, [fetchRides, isAuthenticated])

  const handleCancel = async (rideId: string) => {
    setCancellingId(rideId)
    setError('')
    try {
      await apiCancelRide(rideId)
      await fetchRides()
    } catch (err: unknown) {
      const ae = err as { response?: { data?: { message?: string } } }
      setError(ae.response?.data?.message ?? 'Failed to cancel ride.')
    } finally {
      setCancellingId(null)
    }
  }

  const toggleLegs = (rideId: string) => {
    setExpandedLegs((prev) => ({ ...prev, [rideId]: !prev[rideId] }))
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-[#00d4ff]" />
          <h2 className="text-sm font-semibold text-[#f0f4ff] uppercase tracking-wider">
            My Ride Requests
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#4d6080]">
              <Wifi className="w-3 h-3 text-[#00ff9d]" />
              {lastRefresh.toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
          <button
            onClick={fetchRides}
            disabled={loading}
            className="btn-secondary px-3 py-2 text-xs"
          >
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
              <p className="text-sm text-[#4d6080] mt-1">
                Use the Request tab to book your first Tesla Pool ride
              </p>
            </>
          ) : (
            <>
              <p className="text-[#8ba3c7] font-medium">Log in to see your rides</p>
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="btn-primary mt-4 px-4 py-2 text-xs"
              >
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
            const breakdown = ride.fareBreakdown
            const isExpanded = Boolean(expandedLegs[ride.id])
            const canCancel = ['REQUESTED', 'MATCHED'].includes(ride.stage)
            const driverAssigned = ride.pool?.tesla
            const driverUser = ride.pool?.tesla?.driver
            const isMatchedOrLater = ['MATCHED', 'DRIVER_ARRIVED', 'COMPLETED'].includes(ride.stage)
            const isCompleted = ride.stage === 'COMPLETED'
            const existingReview = ride.review || localReviews[ride.id]
            const showReviewPrompt = isCompleted && !existingReview

            // Co-riders in the same pool (excluding current rider)
            const coRiders =
              ride.pool?.rideRequests?.filter(
                (r) => r.id !== ride.id && r.passengerId !== ride.passengerId
              ) ?? []

            return (
              <div
                key={ride.id}
                className="glass-card p-4 hover:border-[#1f2d44]/70 transition-colors duration-200"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#f0f4ff]">
                      <span>
                        {ZONE_EMOJI[ride.pickupZone] ?? '📍'} {ride.pickupZone}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#4d6080] shrink-0" />
                      <span>
                        {ZONE_EMOJI[ride.destinationZone] ?? '📍'} {ride.destinationZone}
                      </span>
                    </div>
                    {breakdown?.corridorName && (
                      <p className="text-xs text-[#00d4ff] flex items-center gap-1 mt-0.5 font-medium">
                        <Route className="w-3 h-3" />
                        {breakdown.corridorName}
                      </p>
                    )}
                  </div>
                  <div className={cn('status-badge shrink-0', meta.color, meta.bg)}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {meta.label}
                  </div>
                </div>

                {/* Ride basic stats */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#4d6080] mb-3">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3 text-[#8ba3c7]" />
                    {ride.seats} seat{ride.seats > 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1 text-[#00d4ff] font-bold text-sm">
                    {formatBDT(fareBDT)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(ride.createdAt)}
                  </span>
                </div>

                {/* Assigned driver badge (CHANGE 6: name + star rating, clickable to full profile) */}
                {isMatchedOrLater && driverAssigned && driverUser && (
                  <div className="mb-3">
                    <DriverInfoBadge
                      driverId={driverUser.id}
                      driverName={driverUser.name}
                      teslaInfo={`${driverAssigned.name} · ${driverAssigned.plate}`}
                    />
                  </div>
                )}

                {/* Co-riders (CHANGE 6: show co-riders' names if pool has others) */}
                {coRiders.length > 0 && (
                  <div className="mb-3 flex items-center gap-2 text-xs text-[#8ba3c7] bg-[#0a0e17]/30 px-2.5 py-1.5 rounded-lg border border-[#1f2d44]/30">
                    <Users className="w-3.5 h-3.5 text-[#00d4ff]" />
                    <span className="text-[#4d6080]">Co-riders:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {coRiders.map((cr) => (
                        <span key={cr.id} className="inline-flex items-center gap-1">
                          <UserNameBadge
                            userId={cr.passenger.id}
                            name={cr.passenger.name}
                            className="font-medium text-[#f0f4ff]"
                          />
                          <span className="text-[10px] text-[#4d6080]">({cr.seats}s → {cr.destinationZone})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Leg-by-leg breakdown */}
                {breakdown && (
                  <div className="mt-2 pt-2 border-t border-[#1f2d44]/50">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-[#8ba3c7]">
                          Shared:{' '}
                          <strong className="text-[#00ff9d]">
                            {formatBDT(breakdown.sharedPortionBDT)}
                          </strong>
                        </span>
                        {breakdown.soloPortionBDT > 0 && (
                          <span className="text-[#8ba3c7]">
                            Solo:{' '}
                            <strong className="text-[#f0f4ff]">
                              {formatBDT(breakdown.soloPortionBDT)}
                            </strong>
                          </span>
                        )}
                        {breakdown.totalDiscountBDT > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#00ff9d] bg-[#00ff9d]/10 px-2 py-0.5 rounded-full border border-[#00ff9d]/20">
                            <Tag className="w-2.5 h-2.5" />
                            Save {formatBDT(breakdown.totalDiscountBDT)}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleLegs(ride.id)}
                        className="text-[11px] text-[#00d4ff] hover:underline flex items-center gap-1 font-medium"
                      >
                        <Layers className="w-3 h-3" />
                        {isExpanded ? 'Hide Legs' : 'View Legs'}
                      </button>
                    </div>

                    {isExpanded && breakdown.legs.length > 0 && (
                      <div className="mt-2.5 space-y-1.5 bg-[#0a0e17]/60 p-2.5 rounded-xl border border-[#1f2d44]/40">
                        {breakdown.legs.map((leg, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-[11px] text-[#8ba3c7] py-0.5"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="w-4 h-4 rounded-full bg-[#1c2740] text-[9px] flex items-center justify-center font-bold text-[#00d4ff]">
                                {idx + 1}
                              </span>
                              <span>
                                {leg.fromZone} → {leg.toZone}
                              </span>
                              <span className="text-[#4d6080]">({leg.distanceKm} km)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  'px-1.5 rounded text-[10px] font-semibold',
                                  leg.discountPct > 0
                                    ? 'bg-[#00ff9d]/15 text-[#00ff9d]'
                                    : 'bg-[#1c2740] text-[#8ba3c7]'
                                )}
                              >
                                {leg.discountPct > 0
                                  ? `-${leg.discountPct}% (${leg.riderCount} riders)`
                                  : 'Full (Solo)'}
                              </span>
                              <span className="font-semibold text-[#f0f4ff]">
                                {formatBDT(leg.riderFareBDT)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Pool seat bar + cancel */}
                <div className="mt-3 flex items-center justify-between gap-3 pt-2 border-t border-[#1f2d44]/30">
                  {ride.pool ? (
                    <div className="flex items-center gap-2 text-xs flex-1">
                      <div className="flex-1 max-w-[120px] bg-[#1c2740] rounded-full overflow-hidden h-1.5">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(ride.pool.seatsTaken / ride.pool.seatsCap) * 100}%`,
                            background: 'linear-gradient(90deg, #00d4ff, #00ff9d)',
                          }}
                        />
                      </div>
                      <span className="text-[#4d6080] text-[11px]">
                        {ride.pool.seatsTaken}/{ride.pool.seatsCap} seats
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}

                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => handleCancel(ride.id)}
                      disabled={cancellingId === ride.id}
                      className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 transition-all duration-150 disabled:opacity-50"
                    >
                      {cancellingId === ride.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <XCircle className="w-3 h-3" />
                      )}
                      Cancel Ride
                    </button>
                  )}
                </div>

                {/* Submitted review display (CHANGE 7: show submitted rating instead of input) */}
                {existingReview && (
                  <div className="mt-3 pt-2.5 border-t border-[#1f2d44]/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Star className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[#8ba3c7]">Your Review:</span>
                      <span className="text-amber-400 font-semibold tracking-tight">
                        {'★'.repeat(existingReview.rating)}
                        {'☆'.repeat(5 - existingReview.rating)}
                      </span>
                      <span className="text-xs font-bold text-[#f0f4ff]">{existingReview.rating}/5</span>
                      {existingReview.comment && (
                        <span className="text-[#4d6080] italic ml-1">&ldquo;{existingReview.comment}&rdquo;</span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#00ff9d] bg-[#00ff9d]/10 px-2 py-0.5 rounded-full border border-[#00ff9d]/20">
                      Reviewed ✓
                    </span>
                  </div>
                )}

                {/* Review prompt for completed rides without a review (CHANGE 7) */}
                {showReviewPrompt && driverAssigned && (
                  <ReviewPrompt
                    rideId={ride.id}
                    driverName={driverUser?.name ?? driverAssigned.name}
                    onDone={(rating, comment) =>
                      setLocalReviews((prev) => ({ ...prev, [ride.id]: { rating, comment } }))
                    }
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {rides.length > 0 && (
        <p className="text-center text-xs text-[#4d6080]">
          {rides.length} ride{rides.length !== 1 ? 's' : ''} total · auto-refreshes every 15s
        </p>
      )}
    </div>
  )
}

