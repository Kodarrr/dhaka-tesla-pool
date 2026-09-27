'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiGetShareableRides, apiJoinPool, ZONES } from '@/lib/api'
import { cn, formatBDT, ZONE_EMOJI } from '@/lib/utils'
import type { ShareableRide, Zone, PaymentMethod } from '@/lib/api'
import { UserNameBadge } from '@/components/ui/user-profile-card'
import {
  Search,
  MapPin,
  Users,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Car,
  RefreshCw,
  Armchair,
  Navigation,
  Sparkles,
  Route,
} from 'lucide-react'
import { getDistance } from '@/lib/api'

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

// ── JoinPanel ────────────────────────────────────────────────────────────────

interface JoinPanelProps {
  pool: ShareableRide
  onJoined: () => void
  initialPickup?: Zone
  initialDestination?: Zone
}

function JoinPanel({
  pool,
  onJoined,
  initialPickup,
  initialDestination,
}: JoinPanelProps) {
  const { isAuthenticated, openAuthModal } = useAuth()

  const cZones =
    pool.corridorZones && pool.corridorZones.length > 1
      ? pool.corridorZones
      : null
  const currentLoc = pool.currentLocation ?? pool.pickupZone
  const currentZoneIdx = cZones ? cZones.indexOf(currentLoc) : -1
  const minPickupIdx = currentZoneIdx >= 0 ? currentZoneIdx : 0

  // Allowed boarding locations:
  const allowedSources: Zone[] = cZones
    ? cZones.slice(minPickupIdx, cZones.length - 1).length > 0
      ? cZones.slice(minPickupIdx, cZones.length - 1)
      : [currentLoc]
    : ZONES

  const computedInitialSource: Zone =
    initialPickup && allowedSources.includes(initialPickup)
      ? initialPickup
      : allowedSources.includes(currentLoc)
      ? currentLoc
      : allowedSources[0] ?? currentLoc

  const [source, setSource] = useState<Zone>(computedInitialSource)

  // Allowed destinations for selected source:
  const sourceIdx = cZones ? cZones.indexOf(source) : -1
  const allowedDestinations: Zone[] =
    cZones && sourceIdx >= 0
      ? cZones.slice(sourceIdx + 1)
      : ZONES.filter((z) => z !== source)

  const [destination, setDestination] = useState<Zone>(() => {
    if (initialDestination && allowedDestinations.includes(initialDestination)) {
      return initialDestination
    }
    return (
      allowedDestinations[0] ??
      (ZONES.find((z) => z !== computedInitialSource) ?? 'GULSHAN')
    )
  })

  const [seats, setSeats] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TESLAPAY')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const maxSeats = Math.min(3, pool.seatsAvailable)

  // Check if chosen route is reverse or incompatible
  let isReverse = false
  let reverseReason = ''
  if (cZones) {
    const pIdx = cZones.indexOf(source)
    const dIdx = cZones.indexOf(destination)
    if (pIdx !== -1 && dIdx !== -1 && pIdx >= dIdx) {
      isReverse = true
      reverseReason = `Opposite direction: This ride is heading towards ${
        cZones[cZones.length - 1]
      }. You cannot travel backwards from ${source} to ${destination}.`
    }
  }

  // Live fare preview for the shared journey portion
  const isSameZone = source === destination
  const distanceKm = isSameZone ? 0 : getDistance(source, destination)
  const soloBaseRate = distanceKm * 50
  const perPersonFare = Math.round(soloBaseRate * 0.7)
  const totalFare = perPersonFare * seats
  const totalDiscount = soloBaseRate * seats - totalFare

  const handleSourceChange = (newSource: Zone) => {
    setSource(newSource)
    const newSourceIdx = cZones ? cZones.indexOf(newSource) : -1
    const newAllowedDests =
      cZones && newSourceIdx >= 0
        ? cZones.slice(newSourceIdx + 1)
        : ZONES.filter((z) => z !== newSource)

    if (!newAllowedDests.includes(destination)) {
      setDestination(newAllowedDests[0] ?? (newSource === 'GULSHAN' ? 'MOHAKHALI' : 'GULSHAN'))
    }
  }

  const handleJoin = async () => {
    if (!isAuthenticated) {
      openAuthModal('login')
      return
    }

    if (isSameZone) {
      setError('Pickup and destination must be different zones')
      return
    }

    if (isReverse) {
      setError(reverseReason)
      return
    }

    setError('')
    setLoading(true)

    try {
      await apiJoinPool(pool.poolId, {
        pickupZone: source,
        destinationZone: destination,
        seats,
        paymentMethod,
      })
      setSuccess(true)
      setTimeout(() => {
        onJoined()
      }, 1200)
    } catch (err: unknown) {
      const ae = err as { response?: { data?: { message?: string } } }
      setError(
        ae.response?.data?.message ??
          'Failed to join this ride. It may be full or already departed.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 animate-fade-in">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <p className="text-xs font-medium text-emerald-400">
          Joined corridor pool! Live status is available in My Rides.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-dhaka-border/60 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-dhaka-text-body">
          Join this corridor ride
        </p>
        <span className="text-[11px] text-blue-400 flex items-center gap-1 font-medium">
          <Navigation className="w-3 h-3" /> Vehicle currently at:{' '}
          {pool.currentLocation ?? pool.pickupZone}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Source / Boarding */}
        <div className="space-y-1">
          <label className="text-xs text-[#4d6080] flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#00d4ff]" />
            Boarding from
          </label>
          <div className="relative">
            <select
              value={source}
              onChange={(e) => handleSourceChange(e.target.value as Zone)}
              className="zone-select pr-7 text-xs py-2"
            >
              {allowedSources.map((z) => (
                <option key={z} value={z} style={{ background: '#0f1521' }}>
                  {ZONE_EMOJI[z]} {z}{' '}
                  {z === (pool.currentLocation ?? pool.pickupZone)
                    ? '(Current)'
                    : ''}
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4d6080] rotate-90 pointer-events-none" />
          </div>
        </div>

        {/* Destination */}
        <div className="space-y-1">
          <label className="text-xs text-[#4d6080] flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#00ff9d]" />
            Dropoff to
          </label>
          <div className="relative">
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value as Zone)}
              className="zone-select pr-7 text-xs py-2"
            >
              {allowedDestinations.map((z) => (
                <option key={z} value={z} style={{ background: '#0f1521' }}>
                  {ZONE_EMOJI[z]} {z}
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4d6080] rotate-90 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Seats & Payment Method */}
      <div className="grid grid-cols-2 gap-2">
        {/* Seats */}
        <div className="space-y-1">
          <label className="text-xs text-[#4d6080] flex items-center gap-1">
            <Armchair className="w-3 h-3 text-[#00d4ff]" />
            Seats needed
          </label>
          <div className="flex gap-1.5">
            {Array.from({ length: maxSeats }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSeats(n)}
                className={cn(
                  'flex-1 py-2 rounded-lg border text-xs font-bold transition-all duration-150 cursor-pointer',
                  seats === n
                    ? 'border-[#00d4ff] text-[#08121e] bg-[#00d4ff] shadow-[0_0_12px_rgba(0,212,255,0.4)] scale-105 ring-2 ring-[#00d4ff]/40'
                    : 'border-[#1f2d44]/70 bg-[#101b2b] text-[#8ba3c7] hover:border-[#2d4265] hover:text-[#f0f4ff] active:scale-95'
                )}
              >
                {n} {n === 1 ? 'seat' : 'seats'}
              </button>
            ))}
          </div>
        </div>

        {/* Payment Method */}
        <div className="space-y-1">
          <label className="text-xs text-[#4d6080] font-medium">
            Payment on exit
          </label>
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setPaymentMethod('TESLAPAY')}
              className={cn(
                'py-1.5 px-2 rounded-lg border text-xs font-semibold transition-all duration-150 text-center',
                paymentMethod === 'TESLAPAY'
                  ? 'border-[#00d4ff]/70 text-[#00d4ff] bg-[#00d4ff]/10'
                  : 'border-[#1f2d44]/50 text-[#4d6080] hover:text-[#8ba3c7]'
              )}
            >
              TeslaPay
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('CASH')}
              className={cn(
                'py-1.5 px-2 rounded-lg border text-xs font-semibold transition-all duration-150 text-center',
                paymentMethod === 'CASH'
                  ? 'border-emerald-500/70 text-emerald-400 bg-emerald-500/10'
                  : 'border-[#1f2d44]/50 text-[#4d6080] hover:text-[#8ba3c7]'
              )}
            >
              Cash
            </button>
          </div>
        </div>
      </div>

      {/* Fare preview */}
      {!isSameZone && (
        <div className="rounded-xl bg-[#0f172a]/90 border border-[#1f2d44]/60 p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8ba3c7]">
              Shared distance ({source} → {destination}):
            </span>
            <span className="font-semibold text-white">{distanceKm} km</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-[#8ba3c7]">Solo rate (no pool):</span>
            <span className="text-[#4d6080] line-through">
              {formatBDT(soloBaseRate * seats)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-[#00ff9d] font-medium flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Pool Discount (30% off):
            </span>
            <span className="font-semibold text-[#00ff9d]">
              -{formatBDT(totalDiscount)}
            </span>
          </div>

          <div className="pt-2 border-t border-[#1f2d44]/80 flex items-center justify-between">
            <span className="text-xs font-bold text-white">Your Fare:</span>
            <div className="text-right">
              <span className="text-base font-extrabold text-[#00d4ff]">
                {formatBDT(totalFare)}
              </span>
              {seats > 1 && (
                <span className="text-[10px] text-[#4d6080] block">
                  ({formatBDT(perPersonFare)} × {seats} seats)
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {isReverse && (
        <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{reverseReason}</span>
        </div>
      )}

      {isSameZone && (
        <p className="text-xs text-amber-400 font-medium">
          Pickup and destination must be different zones.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleJoin}
        disabled={loading || isSameZone || isReverse}
        className="btn-primary w-full py-2.5 text-sm font-semibold"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Car className="w-4 h-4" />
        )}
        {isAuthenticated
          ? `Confirm & Join Ride • ${formatBDT(totalFare)}`
          : 'Log in to Join'}
      </button>
    </div>
  )
}

// ── PoolCard ──────────────────────────────────────────────────────────────────

function PoolCard({
  pool,
  onJoined,
  defaultPickup,
  defaultDestination,
}: {
  pool: ShareableRide
  onJoined: () => void
  defaultPickup?: Zone
  defaultDestination?: Zone
}) {
  const [expanded, setExpanded] = useState(false)

  const stageBadgeClass =
    pool.stage === 'IN_PROGRESS'
      ? 'text-[#00d4ff] bg-[#00d4ff]/10 border-[#00d4ff]/30'
      : pool.stage === 'MATCHED'
      ? 'text-[#00ff9d] bg-[#00ff9d]/10 border-[#00ff9d]/30'
      : 'text-amber-400 bg-amber-400/10 border-amber-400/30'

  const currentLoc = pool.currentLocation || pool.pickupZone

  return (
    <div className="glass-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          {/* Tree Match badge if available */}
          {pool.treeMatch && (
            <div className="flex items-center gap-1.5 flex-wrap pb-0.5">
              {pool.treeMatch.matchType === 'EXACT_SUB_ROUTE' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-xs font-semibold text-emerald-400">
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span>🎯 100% Route Match (Sub-route)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#00d4ff]/15 border border-[#00d4ff]/40 text-xs font-semibold text-[#00d4ff]">
                  <Route className="w-3 h-3 text-[#00d4ff]" />
                  <span>
                    🌿 Shared Tree Branch ({pool.treeMatch.overlapRatio}%)
                  </span>
                </span>
              )}
            </div>
          )}

          {/* Current Location badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#00d4ff]/15 border border-[#00d4ff]/40 text-xs font-semibold text-[#00d4ff]">
              <Navigation className="w-3 h-3 animate-pulse" />
              <span>
                Current: {ZONE_EMOJI[currentLoc]} {currentLoc}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-[#8ba3c7]">
              <MapPin className="w-3 h-3 text-[#4d6080]" />
              <span>Origin: {pool.pickupZone}</span>
            </span>
          </div>

          {/* Existing rider destinations */}
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {pool.riders.map((r, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[#1c2740] border border-[#1f2d44]/60 text-[#8ba3c7]"
              >
                {r.passenger && (
                  <UserNameBadge
                    userId={r.passenger.id}
                    name={r.passenger.name}
                    className="text-[#f0f4ff] font-medium"
                  />
                )}
                <span>
                  → {ZONE_EMOJI[r.destinationZone as Zone]} {r.destinationZone}
                </span>
                {r.seats > 1 && <span className="text-[#4d6080]">×{r.seats}</span>}
              </span>
            ))}
          </div>

          {/* Route progression indicator */}
          {pool.corridorZones && pool.corridorZones.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#8ba3c7] bg-[#0f172a]/70 border border-[#1f2d44]/50 px-2.5 py-1 rounded-lg flex-wrap">
              <span className="text-[#00d4ff] font-semibold flex items-center gap-1">
                <Navigation className="w-3 h-3" /> Heading:
              </span>
              {pool.corridorZones.map((z, idx) => (
                <span key={z} className="flex items-center gap-1">
                  <span
                    className={cn(
                      z === currentLoc
                        ? 'text-[#00ff9d] font-bold underline'
                        : 'text-[#8ba3c7]'
                    )}
                  >
                    {z}
                  </span>
                  {idx < pool.corridorZones!.length - 1 && (
                    <span className="text-[#4d6080]">→</span>
                  )}
                </span>
              ))}
              {pool.corridorName && (
                <span className="text-[10px] text-[#4d6080]">
                  ({pool.corridorName})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={cn(
              'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
              stageBadgeClass
            )}
          >
            {pool.stage}
          </span>
          <div className="flex items-center gap-1 text-xs text-[#8ba3c7]">
            <Users className="w-3 h-3 text-[#00d4ff]" />
            <span>
              {pool.seatsAvailable} seat{pool.seatsAvailable !== 1 ? 's' : ''} free
            </span>
          </div>
        </div>
      </div>

      {/* Seat bar */}
      <div className="flex gap-1">
        {Array.from({ length: pool.seatsCap }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 h-1.5 rounded-full',
              i < pool.seatsTaken ? 'bg-[#00d4ff]' : 'bg-[#1f2d44]/60'
            )}
          />
        ))}
      </div>

      {/* Toggle join panel */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'w-full py-2 rounded-xl border text-xs font-semibold transition-all duration-200',
          expanded
            ? 'border-[#00d4ff]/50 text-[#00d4ff] bg-[#00d4ff]/8'
            : 'border-[#1f2d44]/50 text-[#4d6080] hover:border-[#1f2d44]/80 hover:text-[#8ba3c7]'
        )}
      >
        {expanded ? 'Cancel' : '+ Join this ride'}
      </button>

      {expanded && (
        <JoinPanel
          pool={pool}
          initialPickup={defaultPickup}
          initialDestination={defaultDestination}
          onJoined={() => {
            setExpanded(false)
            onJoined()
          }}
        />
      )}
    </div>
  )
}

// ── BrowseSharedRides (main export) ──────────────────────────────────────────

export default function BrowseSharedRides() {
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 350)
  const [rides, setRides] = useState<ShareableRide[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fetchRef = useRef(0)

  // Route selector state for tree matching
  const [userPickup, setUserPickup] = useState<Zone>('BANANI')
  const [userDestination, setUserDestination] = useState<Zone>('MOHAKHALI')
  const [isRouteMatching, setIsRouteMatching] = useState(false)

  const fetchRides = useCallback(
    async (
      q?: string,
      pickup?: Zone,
      destination?: Zone,
      useRouteFilter?: boolean
    ) => {
      const token = ++fetchRef.current
      setLoading(true)
      setError('')
      try {
        const params = {
          search: q || undefined,
          pickupZone: useRouteFilter ? pickup : undefined,
          destinationZone: useRouteFilter ? destination : undefined,
        }
        const data = await apiGetShareableRides(params)
        if (fetchRef.current === token) setRides(data)
      } catch {
        if (fetchRef.current === token)
          setError('Could not load rides. Is the API running?')
      } finally {
        if (fetchRef.current === token) setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchRides(
      debouncedSearch,
      userPickup,
      userDestination,
      isRouteMatching
    )
  }, [debouncedSearch, isRouteMatching, fetchRides, userPickup, userDestination])

  const handleFindMatchedRides = () => {
    if (userPickup === userDestination) return
    setIsRouteMatching(true)
    fetchRides(debouncedSearch, userPickup, userDestination, true)
  }

  const handleClearRouteFilter = () => {
    setIsRouteMatching(false)
    fetchRides(debouncedSearch, undefined, undefined, false)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Route matching card */}
      <div className="glass-card p-4 space-y-4 border border-[#00d4ff]/20 bg-[#0c1322]/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#00d4ff]" />
            <h2 className="text-sm font-semibold text-white">
              Find Matched Rides by Route
            </h2>
          </div>
          {isRouteMatching && (
            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Route Filter Active
            </span>
          )}
        </div>

        <p className="text-xs text-[#8ba3c7]">
          Select your journey&apos;s pickup and destination. The Dhaka Tree algorithm
          will instantly match all open rides traveling along your route.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Source Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#8ba3c7] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#00d4ff]" />
              Pickup Zone (Source)
            </label>
            <div className="relative">
              <select
                value={userPickup}
                onChange={(e) => setUserPickup(e.target.value as Zone)}
                className="zone-select pr-8 text-xs py-2.5 w-full bg-[#141d2e] border border-[#1f2d44] rounded-xl text-white focus:border-[#00d4ff] focus:outline-none"
              >
                {ZONES.map((z) => (
                  <option key={z} value={z} style={{ background: '#0f1521' }}>
                    {ZONE_EMOJI[z]} {z}
                  </option>
                ))}
              </select>
              <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4d6080] rotate-90 pointer-events-none" />
            </div>
          </div>

          {/* Destination Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#8ba3c7] flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#00ff9d]" />
              Dropoff Zone (Destination)
            </label>
            <div className="relative">
              <select
                value={userDestination}
                onChange={(e) => setUserDestination(e.target.value as Zone)}
                className="zone-select pr-8 text-xs py-2.5 w-full bg-[#141d2e] border border-[#1f2d44] rounded-xl text-white focus:border-[#00ff9d] focus:outline-none"
              >
                {ZONES.map((z) => (
                  <option key={z} value={z} style={{ background: '#0f1521' }}>
                    {ZONE_EMOJI[z]} {z}
                  </option>
                ))}
              </select>
              <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4d6080] rotate-90 pointer-events-none" />
            </div>
          </div>
        </div>

        {userPickup === userDestination && (
          <p className="text-xs text-amber-400 font-medium">
            Please choose different pickup and destination zones.
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleFindMatchedRides}
            disabled={userPickup === userDestination || loading}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#00d4ff] to-[#00a3ff] hover:opacity-95 text-[#0a0f1d] font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#00d4ff]/20 transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Find Matched Rides
          </button>

          {isRouteMatching && (
            <button
              type="button"
              onClick={handleClearRouteFilter}
              className="py-2.5 px-4 rounded-xl border border-[#1f2d44] hover:bg-[#141d2e] text-[#8ba3c7] hover:text-white font-medium text-xs transition-all"
            >
              Show All Rides
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-dhaka-text-headline">
            Browse open corridor rides
          </h2>
          <button
            type="button"
            onClick={() =>
              fetchRides(
                debouncedSearch,
                userPickup,
                userDestination,
                isRouteMatching
              )
            }
            className="ml-auto text-dhaka-text-dim hover:text-blue-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw
              className={cn('w-3.5 h-3.5', loading && 'animate-spin')}
            />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-dhaka-text-dim pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by pickup or destination zone…"
            className="w-full bg-dhaka-elevated border border-dhaka-border rounded-xl py-2.5 pl-9 pr-4 text-sm text-dhaka-text-headline placeholder-dhaka-text-dim focus:outline-none focus:border-dhaka-cobalt focus:ring-1 focus:ring-dhaka-cobalt transition-all"
          />
        </div>

        <p className="text-xs text-[#4d6080]">
          {isRouteMatching
            ? `Filtering for rides matching ${userPickup} → ${userDestination}.`
            : 'Showing all open, joinable rides system-wide. Join any ride — corridor-colliding routes get automatic leg discounts.'}
        </p>
      </div>

      {/* State feedback */}
      {error && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading && rides.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-10 text-[#4d6080]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading rides…</span>
        </div>
      )}

      {!loading && rides.length === 0 && !error && (
        <div className="glass-card p-8 text-center space-y-2">
          <Car className="w-8 h-8 text-[#1f2d44] mx-auto" />
          <p className="text-sm font-semibold text-[#4d6080]">
            {isRouteMatching
              ? `No active rides currently matching ${userPickup} → ${userDestination}`
              : 'No open rides right now'}
          </p>
          <p className="text-xs text-[#4d6080]">
            {isRouteMatching ? (
              <button
                type="button"
                onClick={handleClearRouteFilter}
                className="text-[#00d4ff] hover:underline"
              >
                Click here to show all open rides across Dhaka.
              </button>
            ) : search ? (
              `No rides match "${search}". Try a different zone name.`
            ) : (
              'Be the first to request a shareable ride from the Request tab.'
            )}
          </p>
        </div>
      )}

      {/* Pool cards */}
      {rides.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-[#4d6080] px-1">
            {rides.length} {isRouteMatching ? 'matched' : 'open'} ride
            {rides.length !== 1 ? 's' : ''}
            {isRouteMatching && ` for ${userPickup} → ${userDestination}`}
            {search && ` matching "${search}"`}
          </p>
          {rides.map((pool) => (
            <PoolCard
              key={pool.poolId}
              pool={pool}
              defaultPickup={isRouteMatching ? userPickup : undefined}
              defaultDestination={
                isRouteMatching ? userDestination : undefined
              }
              onJoined={() =>
                fetchRides(
                  debouncedSearch,
                  userPickup,
                  userDestination,
                  isRouteMatching
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
