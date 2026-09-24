import axios from 'axios'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'
const TOKEN_KEY = 'dtp_access_token'
const USER_KEY = 'dtp_user'

function isJwt(token: string): boolean {
  return token.split('.').length === 3
}

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
})

apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token && isJwt(token)) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = String(err.config?.url ?? '')
    const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/signup')
    if (err.response?.status === 401 && typeof window !== 'undefined' && !isAuthRoute) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem('dtp_active_role')
      window.dispatchEvent(new Event('dtp-unauthorized'))
    }
    return Promise.reject(err)
  }
)

// ─── Types ───────────────────────────────────────────────────────────────────

export type Zone = 'GULSHAN' | 'BANANI' | 'DHANMONDI' | 'UTTARA' | 'MOTIJHEEL'

export const ZONES: Zone[] = ['GULSHAN', 'BANANI', 'DHANMONDI', 'UTTARA', 'MOTIJHEEL']

export type RideStage =
  | 'REQUESTED' | 'MATCHED' | 'DRIVER_ARRIVED'
  | 'STARTED'  | 'COMPLETED' | 'CANCELLED'

export interface EstimateRequest {
  pickupZone: Zone
  dropoffZone: Zone
  passengerCount: number
}

export interface PoolOption {
  passengers: number
  discountPercentage: number
  perPersonFareBDT: number
  totalFareBDT: number
  totalFarePaisa: number
}

export interface EstimateResponse {
  pickupZone: Zone
  dropoffZone: Zone
  distanceKm: number
  passengerCount: number
  perPersonFareBDT: number
  totalFareBDT: number
  discountPercentage: number
  poolOptions: PoolOption[]
  availablePoolsCount: number
}

export interface RideRequest {
  id: string
  pickupZone: Zone
  destinationZone: Zone
  seats: number
  stage: RideStage
  totalFarePaisa: number
  createdAt: string
  pool?: {
    id: string
    stage: string
    seatsTaken: number
    seatsCap: number
    tesla?: { name: string; plate: string } | null
  } | null
  fareSummary?: {
    totalFareBDT: number
    perPersonFareBDT: number
    discountPercentage: number
  }
}

export interface ActivePool {
  id: string
  pickupZone: Zone
  stage: string
  seatsTaken: number
  seatsCap: number
  createdAt: string
  tesla?: { id: string; name: string; plate: string } | null
  rideRequests: Array<{
    id: string
    destinationZone: Zone
    seats: number
    totalFarePaisa: number
    passenger: { id: string; name: string; email: string }
  }>
}

export interface ActiveRidesResponse {
  activePoolsCount: number
  activeRequestsCount: number
  activePools: ActivePool[]
  activeRequests: RideRequest[]
}

// ─── API helpers ─────────────────────────────────────────────────────────────

export async function apiLogin(email: string, password: string) {
  const { data } = await apiClient.post('/auth/login', { email, password })
  return data as {
    access_token: string
    user: { id: string; name: string; email: string; role: 'PASSENGER' | 'DRIVER' }
  }
}

export async function apiSignup(
  name: string, email: string, password: string, role: 'PASSENGER' | 'DRIVER'
) {
  const { data } = await apiClient.post('/auth/signup', { name, email, password, role })
  return data as { id: string; name: string; email: string; role: 'PASSENGER' | 'DRIVER' }
}

export async function apiEstimate(body: EstimateRequest) {
  const { data } = await apiClient.post<EstimateResponse>('/rides/estimate', body)
  return data
}

export async function apiRequestRide(body: { pickupZone: Zone; destinationZone: Zone; seats: number }) {
  const { data } = await apiClient.post<RideRequest>('/rides/request', body)
  return data
}

export async function apiGetMyRides() {
  const { data } = await apiClient.get<{ rides: RideRequest[] }>('/rides/my-rides')
  return data.rides
}

export async function apiGetActiveRides() {
  const { data } = await apiClient.get<ActiveRidesResponse>('/rides/active')
  return data
}
