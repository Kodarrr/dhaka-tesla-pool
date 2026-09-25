'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import {
  apiGetNotifications,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
  type Notification,
} from '@/lib/api'
import { cn } from '@/lib/utils'
import { Bell, BellRing, CheckCheck, X } from 'lucide-react'

const TYPE_ICON: Record<string, string> = {
  RIDE_ACCEPTED: '🚗',
  RIDER_JOINED: '👤',
  CASH_PAYMENT_MARKED: '💵',
  PAYMENT_CONFIRMED: '✅',
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function NotificationBell() {
  const { isAuthenticated, role } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const { notifications: data } = await apiGetNotifications()
      setNotifications(data)
    } catch {
      // silent — polling may fail if backend is down
    }
  }, [isAuthenticated])

  // Poll every 5 seconds
  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([])
      return
    }
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 5_000)
    return () => clearInterval(interval)
  }, [fetchNotifications, isAuthenticated])

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
      )
      try {
        await apiMarkNotificationRead(n.id)
      } catch {
        // silent
      }
    }
    setOpen(false)

    // Navigate to relevant section/page
    if (n.rideRequestId) {
      router.push(`/?tab=my-rides#ride-${n.rideRequestId}`)
    } else if (n.poolId) {
      router.push(`/?tab=active-pools#pool-${n.poolId}`)
    }
  }

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await apiMarkAllNotificationsRead()
    } catch {
      fetchNotifications()
    }
  }

  if (!isAuthenticated) return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative p-2 rounded-lg transition-all duration-200 cursor-pointer',
          open
            ? 'bg-[#00d4ff]/20 text-[#00d4ff]'
            : 'text-[#8ba3c7] hover:text-[#f0f4ff] hover:bg-[#1f2d44]/50'
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5 text-[#00d4ff] animate-[wiggle_1s_ease-in-out_infinite]" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff4d4f] text-white text-[10px] font-bold flex items-center justify-center border border-[#090d16] shadow-sm">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 z-[100] animate-fade-in">
          <div className="bg-[#0f1521] border border-[#1f2d44]/70 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f2d44]/50 bg-[#161e2e]/50">
              <h3 className="text-sm font-bold text-[#f0f4ff] flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#00d4ff]" />
                Notifications
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-[#00d4ff]/20 text-[#00d4ff] px-2 py-0.5 rounded-full border border-[#00d4ff]/30 font-semibold">
                    {unreadCount} new
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-[#8ba3c7] hover:text-[#00d4ff] transition-colors flex items-center gap-1 cursor-pointer"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    All read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-[#4d6080] hover:text-[#f0f4ff] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div className="max-h-80 overflow-y-auto overscroll-contain">
              {notifications.length === 0 ? (
                <div className="py-10 text-center">
                  <Bell className="w-8 h-8 text-[#4d6080] mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-[#4d6080]">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      'w-full text-left px-4 py-3 border-b border-[#1f2d44]/30 last:border-0 transition-colors flex items-start gap-3 cursor-pointer',
                      n.read
                        ? 'bg-transparent hover:bg-[#1f2d44]/20'
                        : 'bg-[#00d4ff]/5 hover:bg-[#00d4ff]/10'
                    )}
                  >
                    <span className="text-xl shrink-0 mt-0.5">
                      {TYPE_ICON[n.type] ?? '🔔'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs leading-relaxed', n.read ? 'text-[#8ba3c7]' : 'text-[#f0f4ff] font-medium')}>
                        {n.message}
                      </p>
                      <p className="text-[10px] text-[#4d6080] mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-[#00d4ff] shrink-0 mt-1.5" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

