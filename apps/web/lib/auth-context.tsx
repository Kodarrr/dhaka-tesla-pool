'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { apiLogin, apiSignup } from '@/lib/api'

export type UserRole = 'PASSENGER' | 'DRIVER'
export type AuthModalMode = 'login' | 'signup'

export const TOKEN_KEY = 'dtp_access_token'
export const USER_KEY = 'dtp_user'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
}

interface AuthContextType {
  user: AuthUser | null
  token: string | null
  role: UserRole | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string, role: UserRole) => Promise<void>
  logout: () => void
  openAuthModal: (mode?: AuthModalMode) => void
  closeAuthModal: () => void
  authModal: AuthModalMode | null
}

const AuthContext = createContext<AuthContextType | null>(null)

function isJwt(token: string): boolean {
  return token.split('.').length === 3
}

function persistSession(user: AuthUser, token: string) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  localStorage.removeItem('dtp_active_role')
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [authModal, setAuthModal] = useState<AuthModalMode | null>(null)

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    clearSession()
    setAuthModal(null)
  }, [])

  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY)
    const storedUser = localStorage.getItem(USER_KEY)

    if (storedToken && isJwt(storedToken) && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser) as AuthUser
        if (parsedUser?.id && parsedUser?.email && parsedUser?.role) {
          setUser(parsedUser)
          setToken(storedToken)
        } else {
          clearSession()
        }
      } catch {
        clearSession()
      }
    } else {
      clearSession()
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    const onUnauthorized = () => logout()
    window.addEventListener('dtp-unauthorized', onUnauthorized)
    return () => window.removeEventListener('dtp-unauthorized', onUnauthorized)
  }, [logout])

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password)
    setUser(data.user)
    setToken(data.access_token)
    persistSession(data.user, data.access_token)
    setAuthModal(null)
  }, [])

  const signup = useCallback(async (name: string, email: string, password: string, role: UserRole) => {
    await apiSignup(name, email, password, role)
    await login(email, password)
  }, [login])

  const openAuthModal = useCallback((mode: AuthModalMode = 'login') => {
    setAuthModal(mode)
  }, [])

  const closeAuthModal = useCallback(() => setAuthModal(null), [])

  return (
    <AuthContext.Provider value={{
      user,
      token,
      role: user?.role ?? null,
      isAuthenticated: !!user && !!token,
      isLoading,
      login,
      signup,
      logout,
      openAuthModal,
      closeAuthModal,
      authModal,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
