'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import {
  apiGetMyRides,
  apiCancelRide,
  apiSubmitReview,
  apiGetUserProfile,
  apiPayRideV2,
  apiLeaveRide,
  apiGetWallet,
} from '@/lib/api'
import { cn, formatBDT, formatDate, STAGE_META, ZONE_EMOJI } from '@/lib/utils'
import type { RideRequest, DriverProfile, PaymentMethod } from '@/lib/api'
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
  CreditCard,
  Zap,
  Navigation,
  X,
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

// ── PayNowSection ──────────────────────────────────────────────────────────

interface PayNowSectionProps {
  ride: RideRequest
  isPaid: boolean
  onPaid: (rideId: string) => void
}

function PayNowSection({ ride, isPaid, onPaid }: PayNowSectionProps) {
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [payingMethod, setPayingMethod] = useState<'TESLAPAY' | 'CASH' | null>(null)
  const [error, setError] = useState('')

  const fareBDT = Math.round(ride.totalFarePaisa / 100)

  useEffect(() => {
    apiGetWallet()
      .then((w) => setWalletBalance(w.teslaPayBalancePaisa))
      .catch(() => {})
  }, [])

  const handlePay = async (method: 'TESLAPAY' | 'CASH') => {
    setPayingMethod(method)
    setError('')
    try {
      await apiPayRideV2(ride.id, method)
      onPaid(ride.id)
    } catch (err: unknown) {
      const ae = err as { response?: { data?: { message?: string; error?: string } } }
      setError(ae.response?.data?.message ?? ae.response?.data?.error ?? 'Payment failed. Please try again.')
    } finally {
      setPayingMethod(null)
    }
  }

  if (isPaid || ride.paymentStatus === 'PAID') {
    return (
      <div className="mt-3 p-3 rounded-xl bg-[#00ff9d]/15 border border-[#00ff9d]/40 flex items-center justify-between animate-fade-in">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-[#00ff9d] shrink-0" />
          <div>
            <p className="text-xs font-bold text-[#00ff9d]">Payment Confirmed</p>
            <p className="text-[11px] text-[#8ba3c7]">
              {formatBDT(fareBDT)} paid via {ride.paymentMethod === 'TESLAPAY' ? '⚡ TeslaPay' : '💵 Cash'}
              {ride.paidAt && ` · ${formatDate(ride.paidAt)}`}
            </p>
          </div>
        </div>
        <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/25">
          Paid ✓
        </span>
      </div>
    )
  }

  if (ride.paymentStatus === 'PENDING_CONFIRMATION') {
    return (
      <div className="mt-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 animate-fade-in">
        <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
        <div>
          <p className="text-xs font-medium text-amber-400">Waiting for driver to confirm cash payment.</p>
          <p className="text-[11px] text-dhaka-text-body">
            You marked {formatBDT(fareBDT)} cash paid. The driver will confirm receipt shortly.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 p-4 rounded-xl bg-dhaka-elevated/80 border border-amber-400/40 shadow-dhaka-card space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
          <span className="text-xs font-semibold text-amber-400">
            Pay {formatBDT(fareBDT)}
          </span>
        </div>
        <span className="text-sm font-bold text-dhaka-text-headline">{formatBDT(fareBDT)}</span>
      </div>

      <p className="text-xs text-[#8ba3c7]">
        Your ride is completed. Choose your preferred payment method below:
      </p>

      {/* Two payment buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={() => handlePay('TESLAPAY')}
          disabled={Boolean(payingMethod)}
          className="py-2.5 px-3 rounded-xl border border-[#00d4ff]/50 bg-[#00d4ff]/20 hover:bg-[#00d4ff]/30 text-xs font-bold text-[#00d4ff] flex flex-col items-center justify-center gap-0.5 transition-all disabled:opacity-50 cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            {payingMethod === 'TESLAPAY' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            Pay with TeslaPay
          </span>
          <span className="text-[10px] font-normal text-[#8ba3c7]">
            {walletBalance !== null
              ? `(Balance: ৳${(walletBalance / 100).toFixed(0)})`
              : 'Checking balance...'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handlePay('CASH')}
          disabled={Boolean(payingMethod)}
          className="py-2.5 px-3 rounded-xl border border-emerald-500/50 bg-emerald-500/20 hover:bg-emerald-500/30 text-xs font-bold text-[#00ff9d] flex flex-col items-center justify-center gap-0.5 transition-all disabled:opacity-50 cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            {payingMethod === 'CASH' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CreditCard className="w-3.5 h-3.5" />
            )}
            Pay with cash
          </span>
          <span className="text-[10px] font-normal text-[#8ba3c7]">
            Driver confirms receipt
          </span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/30">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
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
  const [localPaid, setLocalPaid] = useState<Record<string, boolean>>({})
  const [leavingId, setLeavingId] = useState<string | null>(null)
  const [paymentMethods, setPaymentMethods] = useState<Record<string, 'TESLAPAY' | 'CASH'>>({})
  const [leaveErrors, setLeaveErrors] = useState<Record<string, string>>({})

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
    const interval = setInterval(fetchRides, 5_000)
    return () => clearInterval(interval)
  }, [fetchRides, isAuthenticated])

  const handleCancel = async (rideId: string) => {
    setCancellingId(rideId)
    setError('')
    try {
      await apiCancelRide(rideId)
      await fetchRides()
    } catch (err: unknown) {
      const ae = err as { response?: { data?: { message?: string; error?: string } } }
      const serverMsg = ae.response?.data?.message || ae.response?.data?.error
      if (serverMsg) {
        setError(serverMsg)
      } else {
        setError('Failed to cancel ride. Please try again.')
      }
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
          <Car className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-dhaka-text-headline">
            My ride requests
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
        <div className="flex items-start justify-between gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm animate-fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-[#8ba3c7] hover:text-[#f0f4ff] p-0.5 transition-colors shrink-0"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
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
            const isDriverAccepted = ride.stage !== 'REQUESTED' || Boolean(ride.pool?.tesla?.driver)
            const canCancel = ride.stage === 'REQUESTED' && !isDriverAccepted
            const driverAssigned = ride.pool?.tesla
            const driverUser = ride.pool?.tesla?.driver
            const isMatched = ride.stage === 'MATCHED'
            const isMatchedOrLater = ['MATCHED', 'DRIVER_ARRIVED', 'IN_PROGRESS', 'ARRIVED_AT_DESTINATION', 'COMPLETED'].includes(ride.stage)
            const isCompleted = ride.stage === 'COMPLETED'
            const existingReview = ride.review || localReviews[ride.id]
            const showReviewPrompt = isCompleted && !existingReview

            // Co-riders in the same pool (excluding current rider and cancelled)
            const coRiders =
              ride.pool?.rideRequests?.filter(
                (r) => r.id !== ride.id && r.passengerId !== ride.passengerId && r.stage !== 'CANCELLED'
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
                    {ride.pool?.currentLocation && (
                      <p className="text-xs text-[#00d4ff] flex items-center gap-1 mt-0.5 font-medium">
                        <Navigation className="w-3 h-3" />
                        <span>Vehicle at: <span className="text-white font-semibold">{ZONE_EMOJI[ride.pool.currentLocation]} {ride.pool.currentLocation}</span></span>
                      </p>
                    )}
                  </div>
                  <div
                    className={cn(
                      'status-badge shrink-0',
                      isMatched && driverUser?.name
                        ? 'text-violet-400 bg-violet-400/10 border-violet-400/30'
                        : cn(meta.color, meta.bg)
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    {isMatched && driverUser?.name ? `Accepted by ${driverUser.name}` : meta.label}
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

                {/* Driver Accepted Banner */}
                {isMatched && driverUser && (
                  <div className="mb-3 px-3.5 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-between text-xs animate-fade-in">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-violet-400 shrink-0" />
                      <span className="text-violet-300 font-medium">
                        Accepted by <span className="text-[#f0f4ff] font-bold">{driverUser.name}</span>
                      </span>
                    </div>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-violet-400/20 text-violet-300 border border-violet-400/30">
                      Driver Assigned
                    </span>
                  </div>
                )}



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

                {/* Payment on Exit & Leave Vehicle action (Requirement 2) */}
                <div className="mt-3 p-3.5 rounded-xl bg-[#0a0e17]/60 border border-[#1f2d44]/50 space-y-2.5">
                  {!isCompleted ? (
                    <>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-medium text-[#8ba3c7]">
                          <CreditCard className="w-4 h-4 text-[#00d4ff]" />
                          <span>Fare: <strong className="text-[#f0f4ff] font-bold">{formatBDT(fareBDT)}</strong> · Due on exit</span>
                        </div>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-400 border border-amber-400/30">
                          PAY ON EXIT
                        </span>
                      </div>

                      {/* Payment method selector */}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[11px] text-[#4d6080]">Payment method:</span>
                        <div className="flex gap-1.5 flex-1">
                          <button
                            type="button"
                            onClick={() => setPaymentMethods((prev) => ({ ...prev, [ride.id]: 'TESLAPAY' }))}
                            className={cn(
                              'flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1',
                              (paymentMethods[ride.id] ?? (ride.paymentMethod === 'CASH' ? 'CASH' : 'TESLAPAY')) === 'TESLAPAY'
                                ? 'bg-[#00d4ff]/15 border-[#00d4ff] text-[#00d4ff]'
                                : 'bg-[#1c2740]/40 border-[#1f2d44]/50 text-[#4d6080] hover:text-[#8ba3c7]'
                            )}
                          >
                            ⚡ TeslaPay
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethods((prev) => ({ ...prev, [ride.id]: 'CASH' }))}
                            className={cn(
                              'flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1',
                              (paymentMethods[ride.id] ?? (ride.paymentMethod === 'CASH' ? 'CASH' : 'TESLAPAY')) === 'CASH'
                                ? 'bg-[#00ff9d]/15 border-[#00ff9d] text-[#00ff9d]'
                                : 'bg-[#1c2740]/40 border-[#1f2d44]/50 text-[#4d6080] hover:text-[#8ba3c7]'
                            )}
                          >
                            💵 Cash
                          </button>
                        </div>
                      </div>

                      {leaveErrors[ride.id] && (
                        <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>{leaveErrors[ride.id]}</span>
                        </div>
                      )}

                      {/* Pay & Leave Vehicle button */}
                      {isMatchedOrLater && (
                        <button
                          type="button"
                          onClick={async () => {
                            const chosenMethod = paymentMethods[ride.id] ?? (ride.paymentMethod === 'CASH' ? 'CASH' : 'TESLAPAY')
                            setLeavingId(ride.id)
                            setLeaveErrors((prev) => ({ ...prev, [ride.id]: '' }))
                            try {
                              await apiLeaveRide(ride.id, chosenMethod)
                              fetchRides()
                            } catch (err: unknown) {
                              const ae = err as { response?: { data?: { message?: string } } }
                              setLeaveErrors((prev) => ({
                                ...prev,
                                [ride.id]: ae.response?.data?.message || 'Payment or exit failed. Please try again.',
                              }))
                              fetchRides()
                            } finally {
                              setLeavingId(null)
                            }
                          }}
                          disabled={leavingId === ride.id}
                          className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-[#090d16] bg-gradient-to-r from-[#00d4ff] to-[#00ff9d] hover:opacity-90 flex items-center justify-center gap-2 shadow-lg shadow-[#00ff9d]/20 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {leavingId === ride.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#090d16]" />
                          ) : (
                            <Navigation className="w-4 h-4 text-[#090d16]" />
                          )}
                          <span>
                            🚪 Pay {formatBDT(fareBDT)} ({(paymentMethods[ride.id] ?? (ride.paymentMethod === 'CASH' ? 'CASH' : 'TESLAPAY')) === 'TESLAPAY' ? '⚡ TeslaPay' : '💵 Cash'}) &amp; Leave Vehicle
                          </span>
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="pt-1 flex items-center justify-between text-xs text-[#00ff9d]">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="w-4 h-4 text-[#00ff9d]" />
                        <span>Journey ended · Paid {formatBDT(fareBDT)} via {ride.paymentMethod === 'CASH' ? '💵 Cash' : '⚡ TeslaPay'}</span>
                      </div>
                      <span className="text-[11px] text-[#8ba3c7]">Arrived at {ride.destinationZone}</span>
                    </div>
                  )}
                </div>

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

                  {!canCancel && isDriverAccepted && !['COMPLETED', 'CANCELLED'].includes(ride.stage) && (
                    <span className="text-[11px] text-[#4d6080] flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0f172a]/60 border border-[#1f2d44]/40">
                      <span className="text-[#00ff9d]">✓</span>
                      <span>Driver accepted • Cancellation locked</span>
                    </span>
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

