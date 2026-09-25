'use client'

import { useState, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiEstimate, apiRequestRideWithShare, ZONES } from '@/lib/api'
import { cn, formatBDT, ZONE_EMOJI } from '@/lib/utils'
import type { EstimateResponse, Zone, PaymentMethod } from '@/lib/api'
import {
  MapPin,
  Navigation,
  Users,
  Zap,
  ChevronRight,
  Loader2,
  Tag,
  AlertCircle,
  Car,
  TrendingDown,
  CheckCircle2,
  Route,
  Layers,
  Share2,
} from 'lucide-react'

const PASSENGER_COUNTS = [1, 2, 3] as const
type PassengerCount = (typeof PASSENGER_COUNTS)[number]

const MAX_SHARE_SEATS_OPTIONS = [0, 1, 2] as const
type MaxShareSeats = (typeof MAX_SHARE_SEATS_OPTIONS)[number]

export default function FareEstimator() {
  const { isAuthenticated, openAuthModal, role } = useAuth()
  const [pickup, setPickup] = useState<Zone>('BANANI')
  const [dropoff, setDropoff] = useState<Zone>('MOHAKHALI')
  const [passengers, setPass] = useState<PassengerCount>(1)
  const [openToShare, setOpenToShare] = useState(false)
  const [maxShareSeats, setMaxShareSeats] = useState<MaxShareSeats>(1)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TESLAPAY')
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState('')
  const [booked, setBooked] = useState(false)

  const handleEstimate = useCallback(async () => {
    if (pickup === dropoff) {
      setError('Pickup and dropoff zones must be different')
      return
    }
    setError('')
    setLoading(true)
    setBooked(false)
    try {
      const data = await apiEstimate({
        pickupZone: pickup,
        dropoffZone: dropoff,
        passengerCount: passengers,
      })
      setEstimate(data)
    } catch (err: unknown) {
      const ae = err as { response?: { data?: { message?: string } } }
      setError(
        ae.response?.data?.message ??
          'Failed to get fare estimate. Please check if a straight-line corridor connects these zones.'
      )
    } finally {
      setLoading(false)
    }
  }, [pickup, dropoff, passengers])

  const handleBook = useCallback(async () => {
    if (!estimate) return
    if (!isAuthenticated) {
      openAuthModal('login')
      return
    }
    if (role !== 'PASSENGER') {
      setError('Only passenger accounts can book a Tesla Pool.')
      return
    }
    setError('')
    setBooking(true)
    try {
      await apiRequestRideWithShare({
        pickupZone: pickup,
        destinationZone: dropoff,
        seats: passengers,
        openToShare,
        maxShareSeats: openToShare ? maxShareSeats : 0,
        paymentMethod,
      })
      setBooked(true)
    } catch (err: unknown) {
      const ae = err as { response?: { data?: { message?: string } } }
      setError(
        ae.response?.data?.message ??
          'Booking failed — you may already have an active ride in progress.'
      )
    } finally {
      setBooking(false)
    }
  }, [estimate, pickup, dropoff, passengers, openToShare, maxShareSeats, paymentMethod, isAuthenticated, openAuthModal, role])

  const onZoneChange =
    (fn: (z: Zone) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
      fn(e.target.value as Zone)
      setEstimate(null)
      setBooked(false)
    }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Zone + passenger selectors */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Navigation className="w-4 h-4 text-[#00d4ff]" />
          <h2 className="text-sm font-semibold text-[#f0f4ff] uppercase tracking-wider">
            Request a Ride
          </h2>
        </div>

        {/* Pickup / Dropoff */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-[#4d6080] font-medium flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-[#00d4ff]" />
              Pickup Zone
            </label>
            <div className="relative">
              <select
                value={pickup}
                onChange={onZoneChange(setPickup)}
                className="zone-select pr-8"
              >
                {ZONES.map((z) => (
                  <option key={z} value={z} style={{ background: '#0f1521' }}>
                    {ZONE_EMOJI[z]} {z}
                  </option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4d6080] rotate-90 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-[#4d6080] font-medium flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-[#00ff9d]" />
              Dropoff Zone
            </label>
            <div className="relative">
              <select
                value={dropoff}
                onChange={onZoneChange(setDropoff)}
                className="zone-select pr-8"
              >
                {ZONES.map((z) => (
                  <option key={z} value={z} style={{ background: '#0f1521' }}>
                    {ZONE_EMOJI[z]} {z}
                  </option>
                ))}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4d6080] rotate-90 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Seats */}
        <div className="space-y-2">
          <label className="text-xs text-[#4d6080] font-medium flex items-center gap-1.5">
            <Users className="w-3 h-3 text-[#00d4ff]" />
            My Seats
          </label>
          <div className="flex gap-2">
            {PASSENGER_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setPass(n)
                  setEstimate(null)
                  setBooked(false)
                }}
                className={cn(
                  'flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all duration-200',
                  passengers === n
                    ? 'border-[#00d4ff]/70 text-[#00d4ff] bg-[#00d4ff]/10'
                    : 'border-[#1f2d44]/50 text-[#4d6080] hover:border-[#1f2d44]/80 hover:text-[#8ba3c7]'
                )}
              >
                {n} {n === 1 ? 'Seat' : 'Seats'}
              </button>
            ))}
          </div>
        </div>

        {/* Open to Share toggle */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setOpenToShare((v) => !v)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all duration-200',
              openToShare
                ? 'border-[#00ff9d]/50 bg-[#00ff9d]/8 text-[#00ff9d]'
                : 'border-[#1f2d44]/50 text-[#4d6080] hover:border-[#1f2d44]/80 hover:text-[#8ba3c7]'
            )}
          >
            <Share2 className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">Open to share ride</span>
            <span
              className={cn(
                'w-8 h-4 rounded-full relative transition-colors duration-200 shrink-0',
                openToShare ? 'bg-[#00ff9d]' : 'bg-[#1f2d44]'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-3 h-3 rounded-full bg-[#090d16] transition-all duration-200',
                  openToShare ? 'left-4' : 'left-0.5'
                )}
              />
            </span>
          </button>

          {openToShare && (
            <div className="space-y-2 pl-1 animate-fade-in">
              <p className="text-xs text-[#4d6080] font-medium">
                Allow up to how many extra riders?
              </p>
              <div className="flex gap-2">
                {MAX_SHARE_SEATS_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMaxShareSeats(n)}
                    disabled={passengers + n > 3}
                    className={cn(
                      'flex-1 py-2 rounded-xl border text-sm font-semibold transition-all duration-200',
                      maxShareSeats === n && passengers + n <= 3
                        ? 'border-[#00ff9d]/70 text-[#00ff9d] bg-[#00ff9d]/10'
                        : 'border-[#1f2d44]/50 text-[#4d6080] hover:border-[#1f2d44]/80 hover:text-[#8ba3c7] disabled:opacity-40 disabled:cursor-not-allowed'
                    )}
                  >
                    +{n}
                  </button>
                ))}
              </div>
              {passengers + maxShareSeats <= 3 && (
                <p className="text-xs text-[#00ff9d] flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  Pool cap: {passengers + maxShareSeats} seats — others can join &amp; split fares
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleEstimate}
          disabled={loading || pickup === dropoff}
          className="btn-primary w-full"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          Get Fare Estimate
        </button>
      </div>

      {/* Result */}
      {estimate && !loading && (
        <div className="space-y-4 animate-slide-up">
          {/* Main card */}
          <div className="glass-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-[#8ba3c7] mb-1">
                  <span>
                    {ZONE_EMOJI[estimate.pickupZone]} {estimate.pickupZone}
                  </span>
                  <ChevronRight className="w-3 h-3" />
                  <span>
                    {ZONE_EMOJI[estimate.dropoffZone]} {estimate.dropoffZone}
                  </span>
                </div>
                {estimate.corridorName && (
                  <p className="text-xs text-[#00d4ff] flex items-center gap-1 font-medium mb-1">
                    <Route className="w-3 h-3" />
                    {estimate.corridorName}
                  </p>
                )}
                <p className="text-2xl font-bold text-[#f0f4ff]">
                  {formatBDT(estimate.perPersonFareBDT)}
                  <span className="text-sm font-normal text-[#8ba3c7] ml-1">
                    / person
                  </span>
                </p>
                <p className="text-xs text-[#8ba3c7] mt-0.5">
                  Total: {formatBDT(estimate.totalFareBDT)} for{' '}
                  {estimate.passengerCount}{' '}
                  {estimate.passengerCount === 1 ? 'rider' : 'riders'}
                </p>
              </div>
              <div className="text-right space-y-1">
                {estimate.discountPercentage > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00ff9d]/15 border border-[#00ff9d]/30">
                    <Tag className="w-3 h-3 text-[#00ff9d]" />
                    <span className="text-xs font-bold text-[#00ff9d]">
                      -{estimate.discountPercentage}% OFF
                    </span>
                  </div>
                )}
                <p className="text-xs text-[#4d6080]">
                  {estimate.distanceKm} km route
                </p>
              </div>
            </div>

            {/* Leg-by-leg preview */}
            {estimate.breakdown && estimate.breakdown.legs.length > 0 && (
              <div className="mb-4 p-3 bg-[#0a0e17]/60 rounded-xl border border-[#1f2d44]/50">
                <div className="flex items-center justify-between text-xs text-[#4d6080] mb-2 font-medium">
                  <span className="flex items-center gap-1">
                    <Layers className="w-3 h-3 text-[#00d4ff]" />
                    Corridor Leg Breakdown
                  </span>
                  <span>
                    {estimate.breakdown.legs.length} Leg
                    {estimate.breakdown.legs.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {estimate.breakdown.legs.map((leg, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs text-[#8ba3c7]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-[#1c2740] text-[9px] flex items-center justify-center font-bold text-[#00d4ff]">
                          {i + 1}
                        </span>
                        <span>
                          {leg.fromZone} → {leg.toZone}
                        </span>
                        <span className="text-[#4d6080]">({leg.distanceKm} km)</span>
                      </div>
                      <span className="font-semibold text-[#f0f4ff]">
                        {formatBDT(leg.riderFareBDT)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="divider" />

            <div className="grid grid-cols-3 gap-3 mt-3">
              {[
                { label: 'Distance', value: `${estimate.distanceKm} km` },
                {
                  label: 'Pool Options',
                  value: estimate.poolOptions.length.toString(),
                  highlight: false,
                },
                {
                  label: 'Discount',
                  value:
                    estimate.discountPercentage > 0
                      ? `${estimate.discountPercentage}%`
                      : 'None',
                  highlight: estimate.discountPercentage > 0,
                },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="glass-card-sm p-3 text-center">
                  <p
                    className={cn(
                      'text-sm font-bold',
                      highlight ? 'text-[#00ff9d]' : 'text-[#f0f4ff]'
                    )}
                  >
                    {value}
                  </p>
                  <p className="text-xs text-[#4d6080] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pool comparison */}
          <div>
            <h3 className="text-xs font-semibold text-[#4d6080] uppercase tracking-wider mb-2 px-1">
              Pool Options
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {estimate.poolOptions.map((opt) => (
                <div
                  key={opt.passengers}
                  onClick={() => setPass(opt.passengers as PassengerCount)}
                  className={cn(
                    'glass-card-sm p-3 cursor-pointer transition-all duration-200',
                    passengers === opt.passengers &&
                      'border-[#00d4ff]/50 bg-[#00d4ff]/5'
                  )}
                >
                  <div className="flex items-center gap-0.5 mb-2">
                    {Array.from({ length: opt.passengers }).map((_, i) => (
                      <Users key={i} className="w-3 h-3 text-[#00d4ff]" />
                    ))}
                  </div>
                  <p className="text-sm font-bold text-[#f0f4ff]">
                    {formatBDT(opt.perPersonFareBDT)}
                  </p>
                  <p className="text-xs text-[#4d6080] mt-0.5">per person</p>
                  {opt.discountPercentage > 0 && (
                    <p className="text-xs text-[#00ff9d] mt-1 font-semibold">
                      -{opt.discountPercentage}%
                    </p>
                  )}
                  {passengers === opt.passengers && (
                    <p className="text-xs text-[#00d4ff] font-semibold mt-1">
                      Selected ✓
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#4d6080] uppercase tracking-wider px-1">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('TESLAPAY')}
                className={cn(
                  'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all duration-200',
                  paymentMethod === 'TESLAPAY'
                    ? 'border-[#00d4ff] bg-[#00d4ff]/15 text-[#00d4ff] shadow-sm shadow-[#00d4ff]/20'
                    : 'border-[#1f2d44] bg-[#0a0e17]/60 text-[#8ba3c7] hover:border-[#1f2d44]/80'
                )}
              >
                <span>⚡ TeslaPay</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={cn(
                  'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all duration-200',
                  paymentMethod === 'CASH'
                    ? 'border-[#00ff9d] bg-[#00ff9d]/15 text-[#00ff9d] shadow-sm shadow-[#00ff9d]/20'
                    : 'border-[#1f2d44] bg-[#0a0e17]/60 text-[#8ba3c7] hover:border-[#1f2d44]/80'
                )}
              >
                <span>💵 Cash</span>
              </button>
            </div>
          </div>

          {/* Book button / success */}
          {booked ? (
            <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-[#00ff9d]/10 border border-[#00ff9d]/30 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-[#00ff9d] shrink-0" />
              <div>
                <p className="text-sm font-semibold text-[#00ff9d]">
                  Ride Requested!
                  {openToShare && ' (Open to share)'}
                </p>
                <p className="text-xs text-[#8ba3c7] mt-0.5">
                  Check &quot;My Rides&quot; tab for live status.
                  {openToShare && ' Others can join via the Browse tab.'}
                </p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleBook}
              disabled={booking}
              className="btn-primary w-full py-4 text-base"
            >
              {booking ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Car className="w-5 h-5" />
              )}
              {isAuthenticated
                ? `Book Tesla Pool — ${formatBDT(estimate.perPersonFareBDT)}/person (${paymentMethod === 'TESLAPAY' ? '⚡ TeslaPay' : '💵 Cash'})`
                : 'Log in to Book Tesla Pool'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
