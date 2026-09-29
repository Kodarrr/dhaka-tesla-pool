'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiGetDriverStatus, apiToggleDriverStatus } from '@/lib/api'

export function useDriverStatus() {
  const { user, isAuthenticated } = useAuth()
  const storageKey = user?.id ? `driver_online_${user.id}` : 'driver_online'

  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem(storageKey)
    return saved === null ? true : saved === 'true'
  })
  const [loading, setLoading] = useState(false)

  // Fetch verified status from DB when authenticated as driver
  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'DRIVER') return
    let active = true

    apiGetDriverStatus()
      .then((res) => {
        if (!active) return
        setIsOnline(res.isOnline)
        localStorage.setItem(storageKey, String(res.isOnline))
      })
      .catch(() => {})

    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<{ isOnline: boolean }>
      if (typeof customEvent.detail?.isOnline === 'boolean') {
        setIsOnline(customEvent.detail.isOnline)
      }
    }

    window.addEventListener('dtp-driver-online-sync', handleSync)
    return () => {
      active = false
      window.removeEventListener('dtp-driver-online-sync', handleSync)
    }
  }, [isAuthenticated, user?.id, user?.role, storageKey])

  const toggleOnline = useCallback(
    async (forced?: boolean) => {
      if (loading) return isOnline
      const next = typeof forced === 'boolean' ? forced : !isOnline
      setLoading(true)
      try {
        const res = await apiToggleDriverStatus(next)
        setIsOnline(res.isOnline)
        localStorage.setItem(storageKey, String(res.isOnline))
        window.dispatchEvent(
          new CustomEvent('dtp-driver-online-sync', { detail: { isOnline: res.isOnline } })
        )
        return res.isOnline
      } catch (err) {
        console.error('Failed to toggle driver online status:', err)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [isOnline, loading, storageKey]
  )

  return { isOnline, loading, toggleOnline }
}

