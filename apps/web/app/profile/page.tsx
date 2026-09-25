'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import Navbar from '@/components/navbar'
import StarRating from '@/components/ui/star-rating'
import {
  apiGetUserProfile,
  apiGetPassengerHistory,
  apiGetDriverHistory,
  type UserProfile,
  type PassengerHistoryResponse,
  type DriverHistoryResponse,
} from '@/lib/api'
import { cn, formatPaisa, formatDate, STAGE_META, ZONE_EMOJI } from '@/lib/utils'
import {
  User,
  Car,
  Calendar,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Clock,
  ChevronRight,
  TrendingUp,
  CreditCard,
  AlertCircle,
  Inbox,
  Users,
} from 'lucide-react'

type ProfileTab = 'overview' | 'history'

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading: authLoading, openAuthModal, role } = useAuth()
  const [tab, setTab] = useState<ProfileTab>('overview')

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const [passengerHistory, setPassengerHistory] = useState<PassengerHistoryResponse | null>(null)
  const [passengerHistoryLoading, setPassengerHistoryLoading] = useState(false)
  const [passengerHistoryError, setPassengerHistoryError] = useState('')

  const [driverHistory, setDriverHistory] = useState<DriverHistoryResponse | null>(null)
  const [driverHistoryLoading, setDriverHistoryLoading] = useState(false)
  const [driverHistoryError, setDriverHistoryError] = useState('')

  const isDriver = role === 'DRIVER'

  const loadProfile = useCallback(async (userId: string) => {
    try {
      setProfileLoading(true)
      const data = await apiGetUserProfile(userId)
      setProfile(data)
    } catch {
      // Ignore or handle
    } finally {
      setProfileLoading(false)
    }
  }, [])

  const loadPassengerHistory = useCallback(async () => {
    try {
      setPassengerHistoryLoading(true)
      setPassengerHistoryError('')
      const data = await apiGetPassengerHistory()
      setPassengerHistory(data)
    } catch (err: any) {
      setPassengerHistoryError(err?.response?.data?.error || 'Failed to load ride history')
    } finally {
      setPassengerHistoryLoading(false)
    }
  }, [])

  const loadDriverHistory = useCallback(async () => {
    try {
      setDriverHistoryLoading(true)
      setDriverHistoryError('')
      const data = await apiGetDriverHistory()
      setDriverHistory(data)
    } catch (err: any) {
      setDriverHistoryError(err?.response?.data?.error || 'Failed to load driving history')
    } finally {
      setDriverHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.id) {
      loadProfile(user.id)
    }
  }, [user?.id, loadProfile])

  useEffect(() => {
    if (isAuthenticated && tab === 'history') {
      if (isDriver) {
        loadDriverHistory()
      } else {
        loadPassengerHistory()
      }
    }
  }, [isAuthenticated, tab, isDriver, loadDriverHistory, loadPassengerHistory])

  if (authLoading) {
    return (
      <div className="min-h-dvh bg-[#090d16] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#00d4ff] animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-dvh bg-[#090d16]">
        <Navbar />
        <main className="max-w-2xl mx-auto px-4 pt-28 pb-16 text-center">
          <div className="glass-card p-8 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <User className="w-6 h-6 text-[#00d4ff]" />
            </div>
            <h2 className="text-xl font-bold text-[#f0f4ff]">Private Account View</h2>
            <p className="text-sm text-[#8ba3c7]">
              Please log in to view your personal profile and history.
            </p>
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="btn-primary px-6 py-2.5 text-sm"
            >
              Login
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#090d16]">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-[#8ba3c7] hover:text-[#00d4ff] mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </Link>

        {/* User Identity Header */}
        <div className="glass-card p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 shadow-lg',
                  isDriver
                    ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-[#090d16]'
                    : 'bg-gradient-to-br from-cyan-500 to-blue-600 text-[#090d16]'
                )}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold text-[#f0f4ff]">{user.name}</h1>
                  <span
                    className={cn(
                      'text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border',
                      isDriver
                        ? 'text-[#00ff9d] bg-[#00ff9d]/10 border-[#00ff9d]/30'
                        : 'text-[#00d4ff] bg-[#00d4ff]/10 border-[#00d4ff]/30'
                    )}
                  >
                    {user.role}
                  </span>
                </div>
                <p className="text-xs text-[#4d6080] mt-1">
                  Personal Account · Private View
                </p>
              </div>
            </div>

            {/* Tab Switcher */}
            <div className="flex bg-[#161e2e]/70 border border-[#1f2d44]/50 rounded-xl p-1 gap-1 shrink-0 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setTab('overview')}
                className={cn(
                  'px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200',
                  tab === 'overview'
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#00ff9d] text-[#090d16] shadow'
                    : 'text-[#8ba3c7] hover:text-[#f0f4ff]'
                )}
              >
                Overview
              </button>
              <button
                type="button"
                onClick={() => setTab('history')}
                className={cn(
                  'px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200',
                  tab === 'history'
                    ? 'bg-gradient-to-r from-[#00d4ff] to-[#00ff9d] text-[#090d16] shadow'
                    : 'text-[#8ba3c7] hover:text-[#f0f4ff]'
                )}
              >
                History
              </button>
            </div>
          </div>
        </div>

        {/* Tab 1: Overview */}
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="glass-card p-6 space-y-5">
              <h2 className="text-base font-bold text-[#f0f4ff] border-b border-[#1f2d44]/40 pb-3">
                Profile Overview
              </h2>

              {profileLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-[#4d6080]">
                  <Loader2 className="w-5 h-5 animate-spin text-[#00d4ff]" />
                  <span className="text-sm">Loading details…</span>
                </div>
              ) : profile ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2.5 text-sm text-[#8ba3c7]">
                    <Calendar className="w-4 h-4 text-[#4d6080]" />
                    <span>
                      Member since{' '}
                      <span className="text-[#f0f4ff] font-medium">
                        {formatDate(profile.memberSince)}
                      </span>
                    </span>
                  </div>

                  {profile.role === 'DRIVER' && (
                    <>
                      {/* Driver Rating */}
                      <div className="p-4 rounded-xl bg-[#0a0e17]/60 border border-[#1f2d44]/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs text-[#4d6080] font-medium">Driver Rating</p>
                          <div className="mt-1">
                            <StarRating
                              rating={profile.averageRating}
                              reviewCount={profile.reviewCount}
                              size="md"
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#4d6080]">Completed Rides</p>
                          <p className="text-lg font-bold text-[#00ff9d]">
                            {profile.totalCompletedRides}
                          </p>
                        </div>
                      </div>

                      {/* Tesla Info */}
                      {profile.tesla ? (
                        <div className="p-4 rounded-xl bg-[#0a0e17]/60 border border-[#1f2d44]/50 space-y-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-[#f0f4ff]">
                            <Car className="w-4 h-4 text-[#00ff9d]" />
                            <span>{profile.tesla.name}</span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-[#8ba3c7]">
                            <div>
                              License Plate:{' '}
                              <span className="font-mono text-[#f0f4ff]">
                                {profile.tesla.plate}
                              </span>
                            </div>
                            <div>
                              Capacity:{' '}
                              <span className="text-[#f0f4ff]">
                                {profile.tesla.capacity} passengers
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>No Tesla registered to this driver account yet.</span>
                        </div>
                      )}
                    </>
                  )}

                  {profile.role === 'PASSENGER' && (
                    <div className="p-4 rounded-xl bg-[#0a0e17]/60 border border-[#1f2d44]/50 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-[#8ba3c7]">
                        <CheckCircle2 className="w-4 h-4 text-[#00d4ff]" />
                        <span>Total Completed Rides Taken</span>
                      </div>
                      <span className="text-lg font-bold text-[#00d4ff]">
                        {profile.totalRidesTaken}
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Tab 2: History */}
        {tab === 'history' && (
          <div className="space-y-6">
            {/* PASSENGER HISTORY */}
            {!isDriver && (
              <>
                {passengerHistoryLoading ? (
                  <div className="flex items-center justify-center py-16 gap-3 text-[#4d6080]">
                    <Loader2 className="w-5 h-5 animate-spin text-[#00d4ff]" />
                    <span className="text-sm">Loading ride history…</span>
                  </div>
                ) : passengerHistoryError ? (
                  <div className="glass-card p-6 text-center text-red-400 text-sm">
                    {passengerHistoryError}
                  </div>
                ) : passengerHistory ? (
                  <>
                    {/* Prominent Spend Total Card */}
                    <div className="glass-card p-6 border-cyan-500/30 bg-gradient-to-br from-cyan-950/20 via-[#0f1521] to-[#0f1521]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#00d4ff]">
                            Total Spent
                          </p>
                          <div className="text-3xl sm:text-4xl font-extrabold text-[#f0f4ff] mt-1 tracking-tight">
                            {formatPaisa(passengerHistory.totalSpentPaisa)}
                          </div>
                          <p className="text-xs text-[#4d6080] mt-1">
                            Only completed rides count toward total spent
                          </p>
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-[#1f2d44]/40 pt-3 sm:pt-0">
                          <p className="text-xs text-[#8ba3c7]">Completed Rides</p>
                          <p className="text-2xl font-bold text-[#00ff9d]">
                            {passengerHistory.completedRideCount}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Rides List */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4d6080] px-1">
                        All Ride Requests ({passengerHistory.rides.length})
                      </h3>

                      {passengerHistory.rides.length === 0 ? (
                        <div className="glass-card p-8 text-center space-y-2">
                          <Inbox className="w-8 h-8 text-[#4d6080] mx-auto" />
                          <p className="text-sm text-[#8ba3c7]">No ride requests found</p>
                        </div>
                      ) : (
                        passengerHistory.rides.map((ride) => {
                          const meta = STAGE_META[ride.stage] ?? STAGE_META.REQUESTED
                          const isCancelled = ride.stage === 'CANCELLED'

                          return (
                            <div
                              key={ride.id}
                              className="glass-card p-4 hover:border-[#1f2d44]/80 transition-colors"
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1.5 min-w-0">
                                  {/* Route */}
                                  <div className="flex items-center gap-2 text-sm font-semibold text-[#f0f4ff]">
                                    <span>
                                      {ZONE_EMOJI[ride.pickupZone] ?? '📍'} {ride.pickupZone}
                                    </span>
                                    <ChevronRight className="w-3.5 h-3.5 text-[#4d6080] shrink-0" />
                                    <span>
                                      {ZONE_EMOJI[ride.destinationZone] ?? '📍'} {ride.destinationZone}
                                    </span>
                                  </div>

                                  {/* Date and Driver */}
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8ba3c7]">
                                    <span className="flex items-center gap-1 text-[#4d6080]">
                                      <Clock className="w-3 h-3" />
                                      {formatDate(ride.createdAt)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Car className="w-3 h-3 text-[#00ff9d]" />
                                      <span className="text-[#4d6080]">Driver:</span>{' '}
                                      <span className="text-[#f0f4ff] font-medium">
                                        {ride.driverName || '—'}
                                      </span>
                                    </span>
                                  </div>
                                </div>

                                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 border-[#1f2d44]/30 pt-2 sm:pt-0">
                                  <div className={cn('status-badge text-[11px]', meta.color, meta.bg)}>
                                    {meta.label}
                                  </div>
                                  <div className="text-right">
                                    {isCancelled ? (
                                      <span
                                        className="text-xs line-through text-[#4d6080]"
                                        title="Cancelled rides do not count toward total spent"
                                      >
                                        {formatPaisa(ride.totalFarePaisa)}
                                      </span>
                                    ) : (
                                      <span className="text-sm font-bold text-[#00d4ff]">
                                        {formatPaisa(ride.totalFarePaisa)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </>
                ) : null}
              </>
            )}

            {/* DRIVER HISTORY */}
            {isDriver && (
              <>
                {driverHistoryLoading ? (
                  <div className="flex items-center justify-center py-16 gap-3 text-[#4d6080]">
                    <Loader2 className="w-5 h-5 animate-spin text-[#00ff9d]" />
                    <span className="text-sm">Loading driving history…</span>
                  </div>
                ) : driverHistoryError ? (
                  <div className="glass-card p-6 text-center space-y-2">
                    <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                    <p className="text-sm text-red-400">{driverHistoryError}</p>
                  </div>
                ) : driverHistory ? (
                  <>
                    {/* Prominent Income Total Card */}
                    <div className="glass-card p-6 border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-[#0f1521] to-[#0f1521]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wider text-[#00ff9d]">
                            Total Income
                          </p>
                          <div className="text-3xl sm:text-4xl font-extrabold text-[#f0f4ff] mt-1 tracking-tight">
                            {formatPaisa(driverHistory.totalIncomePaisa)}
                          </div>
                          <p className="text-xs text-[#4d6080] mt-1">
                            Sum of earnings across all completed trips
                          </p>
                        </div>
                        <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-[#1f2d44]/40 pt-3 sm:pt-0">
                          <p className="text-xs text-[#8ba3c7]">Completed Trips</p>
                          <p className="text-2xl font-bold text-[#00ff9d]">
                            {driverHistory.completedTripCount}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Trips List */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#4d6080] px-1">
                        Completed Trips ({driverHistory.trips.length})
                      </h3>

                      {driverHistory.trips.length === 0 ? (
                        <div className="glass-card p-8 text-center space-y-2">
                          <Inbox className="w-8 h-8 text-[#4d6080] mx-auto" />
                          <p className="text-sm text-[#8ba3c7]">No completed trips yet</p>
                        </div>
                      ) : (
                        driverHistory.trips.map((trip) => (
                          <div
                            key={trip.id}
                            className="glass-card p-5 hover:border-[#1f2d44]/80 transition-colors space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1f2d44]/30 pb-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm font-semibold text-[#f0f4ff]">
                                  <span>Pickup: {ZONE_EMOJI[trip.pickupZone] ?? '📍'} {trip.pickupZone}</span>
                                </div>
                                <p className="text-xs text-[#4d6080] flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  Completed {formatDate(trip.completedAt)}
                                </p>
                              </div>
                              <div className="text-left sm:text-right">
                                <p className="text-xs text-[#4d6080]">Trip Earnings</p>
                                <p className="text-base font-bold text-[#00ff9d]">
                                  {formatPaisa(trip.tripEarningsPaisa)}
                                </p>
                              </div>
                            </div>

                            {/* Riders on this trip */}
                            <div>
                              <p className="text-[11px] font-semibold text-[#4d6080] uppercase tracking-wider mb-2">
                                Passengers on this trip ({trip.riders.length})
                              </p>
                              <div className="space-y-1.5">
                                {trip.riders.map((rider, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-[#0a0e17]/50 border border-[#1f2d44]/40"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Users className="w-3.5 h-3.5 text-[#00d4ff]" />
                                      <span className="font-medium text-[#f0f4ff]">
                                        {rider.name}
                                      </span>
                                      <span className="text-[#4d6080]">→</span>
                                      <span className="text-[#8ba3c7]">
                                        {ZONE_EMOJI[rider.destinationZone] ?? '📍'}{' '}
                                        {rider.destinationZone}
                                      </span>
                                      <span className="text-[#4d6080]">
                                        ({rider.seats} seat{rider.seats > 1 ? 's' : ''})
                                      </span>
                                    </div>
                                    <span className="font-semibold text-[#00d4ff]">
                                      {formatPaisa(rider.totalFarePaisa)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </>
                ) : null}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
