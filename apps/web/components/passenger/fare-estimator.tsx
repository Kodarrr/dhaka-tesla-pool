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
          'Failed to get fare estimate. Please try again.'
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
      <div className="glass-card p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Navigation className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-dhaka-text-headline">
                Route request
              </h2>
              <p className="text-xs text-dhaka-text-dim">Configure your EV corridor trip</p>
            </div>
          </div>
          <span className="text-[11px] font-medium text-blue-300 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full">
            7 Zones Active
          </span>
        </div>

        {/* Integrated Route Selector */}
        <div className="relative rounded-2xl bg-dhaka-elevated/40 border border-dhaka-border p-3 sm:p-4">
          <div className="flex gap-3 sm:gap-4 items-stretch">
            {/* Visual Route Rail */}
            <div className="flex flex-col items-center justify-between py-3 shrink-0">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-400 bg-dhaka-night flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              </div>
              <div className="w-0.5 flex-1 my-1.5 bg-gradient-to-b from-blue-400 via-dhaka-border to-amber-400 opacity-60" />
              <div className="w-3.5 h-3.5 rounded-full border-2 border-amber-400 bg-dhaka-night flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              </div>
            </div>

            {/* Selectors Stack */}
            <div className="flex-1 space-y-3 min-w-0">
              {/* Pickup */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-dhaka-text-dim">
                    Pickup corridor
                  </label>
                  <span className="text-[10px] text-blue-400/80 font-medium">Origin</span>
                </div>
                <div className="relative">
                  <select
                    value={pickup}
                    onChange={onZoneChange(setPickup)}
                    className="zone-select pr-8"
                  >
                    {ZONES.map((z) => (
                      <option key={z} value={z} style={{ background: '#131D2F' }}>
                        {ZONE_EMOJI[z]} {z}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dhaka-text-dim rotate-90 pointer-events-none" />
                </div>
              </div>

              {/* Dropoff */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-dhaka-text-dim">
                    Destination corridor
                  </label>
                  <span className="text-[10px] text-amber-400/80 font-medium">Dropoff</span>
                </div>
                <div className="relative">
                  <select
                    value={dropoff}
                    onChange={onZoneChange(setDropoff)}
                    className="zone-select pr-8"
                  >
                    {ZONES.map((z) => (
                      <option key={z} value={z} style={{ background: '#131D2F' }}>
                        {ZONE_EMOJI[z]} {z}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dhaka-text-dim rotate-90 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Seats Picker - Tactile Segmented Control */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-dhaka-text-body flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-blue-400" />
              Passenger seats reserved
            </label>
            <span className="text-[11px] text-dhaka-text-dim">Max 3 per Tesla</span>
          </div>

          <div className="flex bg-dhaka-elevated/80 p-1 rounded-xl border border-dhaka-border gap-1">
            {[
              { count: 1 as const, title: '1 Seat', sub: 'Solo trip' },
              { count: 2 as const, title: '2 Seats', sub: 'Pair' },
              { count: 3 as const, title: '3 Seats', sub: 'Full pool' },
            ].map(({ count, title, sub }) => (
              <button
                key={count}
                type="button"
                onClick={() => {
                  setPass(count)
                  setEstimate(null)
                  setBooked(false)
                }}
                className={cn(
                  'flex-1 py-2 px-2 rounded-lg text-center transition-all duration-150',
                  passengers === count
                    ? 'bg-dhaka-cobalt text-white shadow-sm font-semibold'
                    : 'text-dhaka-text-body hover:text-dhaka-text-headline hover:bg-dhaka-surface/50'
                )}
              >
                <div className="text-xs font-medium">{title}</div>
                <div className={cn('text-[10px]', passengers === count ? 'text-blue-100' : 'text-dhaka-text-dim')}>
                  {sub}
                </div>
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
              'w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-sm transition-all duration-150',
              openToShare
                ? 'border-blue-500/40 bg-blue-500/10 text-dhaka-text-headline'
                : 'border-dhaka-border bg-dhaka-elevated/30 text-dhaka-text-body hover:border-dhaka-border-light hover:text-dhaka-text-headline'
            )}
          >
            <Share2 className="w-4 h-4 shrink-0 text-blue-400" />
            <div className="flex-1 text-left">
              <p className="text-xs font-medium text-dhaka-text-headline">Open to share ride</p>
              <p className="text-[11px] text-dhaka-text-dim">Allow passengers along this route to join &amp; split fare</p>
            </div>
            <span
              className={cn(
                'w-9 h-5 rounded-full relative transition-colors duration-200 shrink-0 border border-transparent',
                openToShare ? 'bg-dhaka-cobalt' : 'bg-dhaka-border'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow-sm',
                  openToShare ? 'left-4' : 'left-0.5'
                )}
              />
            </span>
          </button>

          {openToShare && (
            <div className="space-y-2 p-3 rounded-xl bg-dhaka-elevated/30 border border-dhaka-border/60 animate-fade-in">
              <p className="text-xs text-dhaka-text-body font-medium">
                Additional seats to open for pooling:
              </p>
              <div className="flex gap-2">
                {MAX_SHARE_SEATS_OPTIONS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMaxShareSeats(n)}
                    disabled={passengers + n > 3}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150',
                      maxShareSeats === n && passengers + n <= 3
                        ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                        : 'border-dhaka-border text-dhaka-text-dim hover:text-dhaka-text-body disabled:opacity-30 disabled:cursor-not-allowed'
                    )}
                  >
                    +{n} {n === 1 ? 'seat' : 'seats'}
                  </button>
                ))}
              </div>
              {passengers + maxShareSeats <= 3 && (
                <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Vehicle pool cap: {passengers + maxShareSeats} seats — fares will split automatically
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Primary CTA - Bold, confident, palette-native */}
        <button
          type="button"
          onClick={handleEstimate}
          disabled={loading || pickup === dropoff}
          className="btn-primary w-full py-3.5 text-sm sm:text-base font-semibold tracking-wide"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4 text-amber-300" />
          )}
          Calculate Corridor Fare
        </button>
      </div>

      {/* Result */}
      {estimate && !loading && (
        <div className="space-y-4 animate-slide-up">
          {/* Main card */}
          <div className="glass-card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 text-xs text-dhaka-text-body mb-1">
                  <span className="font-medium text-dhaka-text-headline">
                    {ZONE_EMOJI[estimate.pickupZone]} {estimate.pickupZone}
                  </span>
                  <ChevronRight className="w-3 h-3 text-dhaka-text-dim" />
                  <span className="font-medium text-dhaka-text-headline">
                    {ZONE_EMOJI[estimate.dropoffZone]} {estimate.dropoffZone}
                  </span>
                </div>
                {estimate.corridorName && (
                  <p className="text-xs text-blue-400 flex items-center gap-1 font-medium mb-1">
                    <Route className="w-3.5 h-3.5" />
                    {estimate.corridorName}
                  </p>
                )}
                <p className="text-2xl sm:text-3xl font-extrabold text-dhaka-text-headline tracking-tight">
                  {formatBDT(estimate.perPersonFareBDT)}
                  <span className="text-sm font-normal text-dhaka-text-dim ml-1.5">
                    / person
                  </span>
                </p>
                <p className="text-xs text-dhaka-text-body mt-0.5">
                  Total route fare: {formatBDT(estimate.totalFareBDT)} for{' '}
                  {estimate.passengerCount}{' '}
                  {estimate.passengerCount === 1 ? 'seat' : 'seats'}
                </p>
              </div>
              <div className="text-right space-y-1">
                {estimate.discountPercentage > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25">
                    <Tag className="w-3 h-3 text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-400">
                      -{estimate.discountPercentage}% off
                    </span>
                  </div>
                )}
                <p className="text-xs text-dhaka-text-dim">
                  {estimate.distanceKm} km expressway leg
                </p>
              </div>
            </div>

            {/* Leg-by-leg preview */}
            {estimate.breakdown && estimate.breakdown.legs.length > 0 && (
              <div className="mb-4 p-3.5 bg-dhaka-elevated/40 rounded-xl border border-dhaka-border/80">
                <div className="flex items-center justify-between text-xs text-dhaka-text-dim mb-2 font-medium">
                  <span className="flex items-center gap-1.5 text-dhaka-text-body">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    Corridor leg breakdown
                  </span>
                  <span>
                    {estimate.breakdown.legs.length} {estimate.breakdown.legs.length === 1 ? 'segment' : 'segments'}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {estimate.breakdown.legs.map((leg, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs text-dhaka-text-body"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full bg-dhaka-surface text-[9px] flex items-center justify-center font-bold text-blue-400 border border-dhaka-border">
                          {i + 1}
                        </span>
                        <span className="text-dhaka-text-headline">
                          {leg.fromZone} → {leg.toZone}
                        </span>
                        <span className="text-dhaka-text-dim text-[11px]">({leg.distanceKm} km)</span>
                      </div>
                      <span className="font-semibold text-dhaka-text-headline">
                        {formatBDT(leg.riderFareBDT)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="divider" />

            <div className="grid grid-cols-3 gap-2.5 mt-3">
              {[
                { label: 'Corridor Distance', value: `${estimate.distanceKm} km` },
                {
                  label: 'Pooling Tiers',
                  value: `${estimate.poolOptions.length} available`,
                  highlight: false,
                },
                {
                  label: 'Discount Rate',
                  value:
                    estimate.discountPercentage > 0
                      ? `${estimate.discountPercentage}%`
                      : 'Standard',
                  highlight: estimate.discountPercentage > 0,
                },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="glass-card-sm p-3 text-center">
                  <p
                    className={cn(
                      'text-sm font-bold',
                      highlight ? 'text-emerald-400' : 'text-dhaka-text-headline'
                    )}
                  >
                    {value}
                  </p>
                  <p className="text-[11px] text-dhaka-text-dim mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pool comparison */}
          <div>
            <div className="mb-2 px-1">
              <h3 className="text-xs font-semibold text-dhaka-text-headline">
                Corridor pooling tiers
              </h3>
              <p className="text-[11px] text-dhaka-text-dim">Per-person rate adjusts with pool occupancy</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {estimate.poolOptions.map((opt) => (
                <div
                  key={opt.passengers}
                  onClick={() => setPass(opt.passengers as PassengerCount)}
                  className={cn(
                    'glass-card-sm p-3 cursor-pointer transition-all duration-150',
                    passengers === opt.passengers
                      ? 'border-blue-500/60 bg-blue-500/10 shadow-sm'
                      : 'hover:border-dhaka-border-light'
                  )}
                >
                  <div className="flex items-center gap-0.5 mb-1.5">
                    {Array.from({ length: opt.passengers }).map((_, i) => (
                      <Users key={i} className="w-3 h-3 text-blue-400" />
                    ))}
                  </div>
                  <p className="text-sm font-bold text-dhaka-text-headline">
                    {formatBDT(opt.perPersonFareBDT)}
                  </p>
                  <p className="text-[11px] text-dhaka-text-dim mt-0.5">per rider</p>
                  {opt.discountPercentage > 0 && (
                    <p className="text-[11px] text-emerald-400 mt-1 font-semibold">
                      -{opt.discountPercentage}% savings
                    </p>
                  )}
                  {passengers === opt.passengers && (
                    <p className="text-[11px] text-blue-300 font-medium mt-1">
                      Selected ✓
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-dhaka-text-body px-1">
              Payment method
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('TESLAPAY')}
                className={cn(
                  'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all duration-150',
                  paymentMethod === 'TESLAPAY'
                    ? 'border-blue-500 bg-blue-500/15 text-blue-300 shadow-sm shadow-blue-500/20'
                    : 'border-dhaka-border bg-dhaka-elevated/40 text-dhaka-text-body hover:border-dhaka-border-light'
                )}
              >
                <span>⚡ TeslaPay (Instant Debit)</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={cn(
                  'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all duration-150',
                  paymentMethod === 'CASH'
                    ? 'border-amber-500 bg-amber-500/15 text-amber-300 shadow-sm shadow-amber-500/20'
                    : 'border-dhaka-border bg-dhaka-elevated/40 text-dhaka-text-body hover:border-dhaka-border-light'
                )}
              >
                <span>💵 Cash on Arrival</span>
              </button>
            </div>
          </div>

          {/* Book button / success */}
          {booked ? (
            <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-400">
                  Ride Requested!
                  {openToShare && ' (Open to corridor pooling)'}
                </p>
                <p className="text-xs text-dhaka-text-body mt-0.5">
                  Check &quot;My Rides&quot; tab for live dispatch status.
                  {openToShare && ' Other commuters along this route can join via Browse.'}
                </p>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleBook}
              disabled={booking}
              className="btn-primary w-full py-4 text-base font-semibold"
            >
              {booking ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Car className="w-5 h-5" />
              )}
              {isAuthenticated
                ? `Confirm Booking — ${formatBDT(estimate.perPersonFareBDT)}/person (${paymentMethod === 'TESLAPAY' ? 'TeslaPay' : 'Cash'})`
                : 'Log in to Confirm Booking'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
