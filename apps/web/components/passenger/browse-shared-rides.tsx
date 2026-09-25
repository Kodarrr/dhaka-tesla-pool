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
} from 'lucide-react'

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
}

function JoinPanel({ pool, onJoined }: JoinPanelProps) {
  const { isAuthenticated, openAuthModal } = useAuth()
  const [destination, setDestination] = useState<Zone>('GULSHAN')
  const [seats, setSeats] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('TESLAPAY')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const maxSeats = Math.min(3, pool.seatsAvailable)

  const handleJoin = useCallback(async () => {
    if (!isAuthenticated) {
      openAuthModal('login')
      return
    }
    setError('')
    setLoading(true)
    try {
      await apiJoinPool(pool.poolId, { destinationZone: destination, seats, paymentMethod })
      setSuccess(true)
      setTimeout(onJoined, 1200)
    } catch (err: unknown) {
      const ae = err as { response?: { data?: { error?: string; message?: string } } }
      const msg = ae.response?.data?.message || (ae.response?.data?.error === 'POOL_FULL' ? 'No available seats remaining in this pool' : 'Failed to join ride. Please try again.')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [pool.poolId, destination, seats, paymentMethod, isAuthenticated, openAuthModal, onJoined])


  if (success) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#00ff9d]/10 border border-[#00ff9d]/30 animate-fade-in">
        <CheckCircle2 className="w-4 h-4 text-[#00ff9d] shrink-0" />
        <p className="text-xs font-semibold text-[#00ff9d]">Joined! Check My Rides for your fare.</p>
      </div>
    )
  }

  return (
    <div className="mt-3 pt-3 border-t border-[#1f2d44]/40 space-y-3">
      <p className="text-xs font-semibold text-[#4d6080] uppercase tracking-wider">Join this ride</p>

      <div className="grid grid-cols-2 gap-2">
        {/* Destination */}
        <div className="space-y-1">
          <label className="text-xs text-[#4d6080] flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#00ff9d]" />
            My dropoff
          </label>
          <div className="relative">
            <select
              value={destination}
              onChange={(e) => setDestination(e.target.value as Zone)}
              className="zone-select pr-7 text-sm py-2"
            >
              {ZONES.filter((z) => z !== pool.pickupZone).map((z) => (
                <option key={z} value={z} style={{ background: '#0f1521' }}>
                  {ZONE_EMOJI[z]} {z}
                </option>
              ))}
            </select>
            <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4d6080] rotate-90 pointer-events-none" />
          </div>
        </div>

        {/* Seats */}
        <div className="space-y-1">
          <label className="text-xs text-[#4d6080] flex items-center gap-1">
            <Armchair className="w-3 h-3 text-[#00d4ff]" />
            Seats
          </label>
          <div className="flex gap-1">
            {Array.from({ length: maxSeats }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSeats(n)}
                className={cn(
                  'flex-1 py-2 rounded-lg border text-xs font-semibold transition-all duration-150',
                  seats === n
                    ? 'border-[#00d4ff]/70 text-[#00d4ff] bg-[#00d4ff]/10'
                    : 'border-[#1f2d44]/50 text-[#4d6080] hover:text-[#8ba3c7]'
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="space-y-1">
        <label className="text-xs text-[#4d6080] font-medium">Payment Method</label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setPaymentMethod('TESLAPAY')}
            className={cn(
              'py-1.5 px-2 rounded-lg border text-xs font-semibold transition-all duration-150',
              paymentMethod === 'TESLAPAY'
                ? 'border-[#00d4ff] bg-[#00d4ff]/15 text-[#00d4ff]'
                : 'border-[#1f2d44]/50 text-[#4d6080] hover:text-[#8ba3c7]'
            )}
          >
            ⚡ TeslaPay
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod('CASH')}
            className={cn(
              'py-1.5 px-2 rounded-lg border text-xs font-semibold transition-all duration-150',
              paymentMethod === 'CASH'
                ? 'border-[#00ff9d] bg-[#00ff9d]/15 text-[#00ff9d]'
                : 'border-[#1f2d44]/50 text-[#4d6080] hover:text-[#8ba3c7]'
            )}
          >
            💵 Cash
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={handleJoin}
        disabled={loading}
        className="btn-primary w-full py-2.5 text-sm"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Car className="w-4 h-4" />}
        {isAuthenticated
          ? `Join Ride (${paymentMethod === 'TESLAPAY' ? '⚡ TeslaPay' : '💵 Cash'})`
          : 'Log in to Join'}
      </button>
    </div>

  )
}

// ── PoolCard ──────────────────────────────────────────────────────────────────

function PoolCard({ pool, onJoined }: { pool: ShareableRide; onJoined: () => void }) {
  const [expanded, setExpanded] = useState(false)

  const stageBadgeClass =
    pool.stage === 'MATCHED'
      ? 'text-[#00ff9d] bg-[#00ff9d]/10 border-[#00ff9d]/30'
      : 'text-[#00d4ff] bg-[#00d4ff]/10 border-[#00d4ff]/30'

  return (
    <div className="glass-card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[#f0f4ff]">
            <MapPin className="w-3.5 h-3.5 text-[#00d4ff] shrink-0" />
            <span>
              {ZONE_EMOJI[pool.pickupZone]} {pool.pickupZone}
            </span>
          </div>
          {/* Existing rider destinations */}
          <div className="flex flex-wrap gap-1.5">
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
                <span>→ {ZONE_EMOJI[r.destinationZone as Zone]} {r.destinationZone}</span>
                {r.seats > 1 && (
                  <span className="text-[#4d6080]">×{r.seats}</span>
                )}
              </span>
            ))}
          </div>
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

  const fetchRides = useCallback(async (q: string) => {
    const token = ++fetchRef.current
    setLoading(true)
    setError('')
    try {
      const data = await apiGetShareableRides(q || undefined)
      if (fetchRef.current === token) setRides(data)
    } catch {
      if (fetchRef.current === token) setError('Could not load rides. Is the API running?')
    } finally {
      if (fetchRef.current === token) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRides(debouncedSearch)
  }, [debouncedSearch, fetchRides])

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Search bar */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-[#00d4ff]" />
          <h2 className="text-sm font-semibold text-[#f0f4ff] uppercase tracking-wider">
            Browse Open Rides
          </h2>
          <button
            type="button"
            onClick={() => fetchRides(debouncedSearch)}
            className="ml-auto text-[#4d6080] hover:text-[#00d4ff] transition-colors"
            title="Refresh"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#4d6080] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by pickup or destination zone…"
            className="w-full bg-[#0a0e17]/60 border border-[#1f2d44]/50 rounded-xl py-2.5 pl-9 pr-4 text-sm text-[#f0f4ff] placeholder-[#4d6080] focus:outline-none focus:border-[#00d4ff]/50 focus:ring-1 focus:ring-[#00d4ff]/20 transition-all"
          />
        </div>

        <p className="text-xs text-[#4d6080]">
          Showing all open, joinable rides system-wide. Join any ride — corridor-colliding routes get automatic leg discounts.
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
          <p className="text-sm font-semibold text-[#4d6080]">No open rides right now</p>
          <p className="text-xs text-[#4d6080]">
            {search
              ? `No rides match "${search}". Try a different zone name.`
              : 'Be the first to request a shareable ride from the Request tab.'}
          </p>
        </div>
      )}

      {/* Pool cards */}
      {rides.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-[#4d6080] px-1">
            {rides.length} open ride{rides.length !== 1 ? 's' : ''}
            {search && ` matching "${search}"`}
          </p>
          {rides.map((pool) => (
            <PoolCard
              key={pool.poolId}
              pool={pool}
              onJoined={() => fetchRides(debouncedSearch)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

