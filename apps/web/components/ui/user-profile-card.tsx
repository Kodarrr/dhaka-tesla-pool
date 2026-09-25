'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGetUserProfile } from '@/lib/api'
import { formatDate, cn } from '@/lib/utils'
import StarRating from '@/components/ui/star-rating'
import type { UserProfile } from '@/lib/api'
import { User, Car, Calendar, CheckCircle2, Loader2, X } from 'lucide-react'

// ── Inline mini-badge (shows name, click to open modal) ──────────────────────

interface UserNameBadgeProps {
  userId: string
  name: string
  className?: string
}

export function UserNameBadge({ userId, name, className }: UserNameBadgeProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
        className={cn(
          'underline decoration-dotted underline-offset-2 decoration-[#4d6080] hover:text-[#00d4ff] hover:decoration-[#00d4ff] transition-colors duration-150 cursor-pointer',
          className
        )}
      >
        {name}
      </button>
      {open && (
        <UserProfileModal userId={userId} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

// ── Modal wrapper ────────────────────────────────────────────────────────────

export function UserProfileModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(9,13,22,0.85)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <UserProfileCard userId={userId} onClose={onClose} />
      </div>
    </div>
  )
}

// ── Profile card (standalone or in modal) ───────────────────────────────────

interface UserProfileCardProps {
  userId: string
  onClose?: () => void
}

export default function UserProfileCard({ userId, onClose }: UserProfileCardProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await apiGetUserProfile(userId)
      setProfile(data)
    } catch {
      setError('Could not load profile.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-[#1f2d44]/60 flex items-center justify-center">
            <User className="w-5 h-5 text-[#00d4ff]" />
          </div>
          <div>
            {loading ? (
              <div className="h-4 w-24 bg-[#1c2740] rounded animate-pulse" />
            ) : (
              <p className="text-sm font-bold text-[#f0f4ff]">{profile?.name}</p>
            )}
            {profile && (
              <span
                className={cn(
                  'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                  profile.role === 'DRIVER'
                    ? 'text-[#00ff9d] bg-[#00ff9d]/10 border-[#00ff9d]/30'
                    : 'text-[#00d4ff] bg-[#00d4ff]/10 border-[#00d4ff]/30'
                )}
              >
                {profile.role}
              </span>
            )}
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[#4d6080] hover:text-[#f0f4ff] transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-4 gap-2 text-[#4d6080]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading profile…</span>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 text-center py-2">{error}</p>
      )}

      {profile && !loading && (
        <div className="space-y-3">
          {/* Member since */}
          <div className="flex items-center gap-2 text-xs text-[#4d6080]">
            <Calendar className="w-3.5 h-3.5" />
            Member since {formatDate(profile.memberSince)}
          </div>

          {profile.role === 'DRIVER' && (
            <>
              {/* Star rating */}
              <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-[#0a0e17]/60 border border-[#1f2d44]/50">
                <StarRating
                  rating={profile.averageRating}
                  reviewCount={profile.reviewCount}
                  size="md"
                />
              </div>

              {/* Tesla info */}
              {profile.tesla && (
                <div className="flex items-center gap-2 text-xs text-[#8ba3c7]">
                  <Car className="w-3.5 h-3.5 text-[#00ff9d]" />
                  <span className="font-semibold text-[#f0f4ff]">{profile.tesla.name}</span>
                  <span className="text-[#4d6080]">·</span>
                  <span>{profile.tesla.plate}</span>
                  <span className="text-[#4d6080]">·</span>
                  <span>{profile.tesla.capacity} seats</span>
                </div>
              )}

              {/* Completed rides */}
              <div className="flex items-center gap-2 text-xs text-[#4d6080]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff9d]" />
                {profile.totalCompletedRides} completed ride{profile.totalCompletedRides !== 1 ? 's' : ''}
              </div>
            </>
          )}

          {profile.role === 'PASSENGER' && (
            <div className="flex items-center gap-2 text-xs text-[#4d6080]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff9d]" />
              {profile.totalRidesTaken} ride{profile.totalRidesTaken !== 1 ? 's' : ''} taken
            </div>
          )}
        </div>
      )}
    </div>
  )
}

