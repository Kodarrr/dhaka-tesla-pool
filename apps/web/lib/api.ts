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

export type Zone =
  | 'GULSHAN'
  | 'BANANI'
  | 'MOHAKHALI'
  | 'DHANMONDI'
  | 'UTTARA'
  | 'MOTIJHEEL'
  | 'BASHUNDHARA'

export const ZONES: Zone[] = [
  'UTTARA',
  'BANANI',
  'MOHAKHALI',
  'GULSHAN',
  'DHANMONDI',
  'MOTIJHEEL',
  'BASHUNDHARA',
]

export type RideStage =
  | 'REQUESTED' | 'MATCHED' | 'DRIVER_ARRIVED'
  | 'COMPLETED' | 'CANCELLED'

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

export interface LegFareBreakdown {
  legIndex: number
  fromZone: Zone
  toZone: Zone
  distanceKm: number
  baseFareBDT: number
  riderCount: number
  discountPct: number
  riderFareBDT: number
  riderFarePaisa: number
}

export interface FareBreakdown {
  requestId?: string
  passengerName?: string
  corridorId: string
  corridorName: string
  pickupZone: Zone
  destinationZone: Zone
  seats: number
  legs: LegFareBreakdown[]
  sharedLegsCount: number
  soloLegsCount: number
  sharedPortionBDT: number
  soloPortionBDT: number
  sharedPortionPaisa: number
  soloPortionPaisa: number
  totalDiscountBDT: number
  totalDiscountPaisa: number
  totalFareBDT: number
  totalFarePaisa: number
}

export interface EstimateResponse {
  pickupZone: Zone
  dropoffZone: Zone
  corridorId?: string
  corridorName?: string
  distanceKm: number
  passengerCount: number
  perPersonFareBDT: number
  totalFareBDT: number
  discountPercentage: number
  breakdown?: FareBreakdown
  poolOptions: PoolOption[]
  availablePoolsCount: number
}

export interface RideRequest {
  id: string
  passengerId: string
  pickupZone: Zone
  destinationZone: Zone
  corridorId?: string | null
  seats: number
  stage: RideStage
  totalFarePaisa: number
  fareBreakdown?: FareBreakdown | null
  createdAt: string
  review?: Review | null
  pool?: {
    id: string
    corridorId?: string | null
    stage: string
    seatsTaken: number
    seatsCap: number
    tesla?: {
      name: string
      plate: string
      driver?: { id: string; name: string } | null
    } | null
    rideRequests?: Array<{
      id: string
      passengerId: string
      destinationZone: Zone
      seats: number
      passenger: { id: string; name: string }
    }>
  } | null
  fareSummary?: {
    totalFareBDT: number
    perPersonFareBDT: number
    sharedPortionBDT?: number
    soloPortionBDT?: number
    totalDiscountBDT?: number
    corridorId?: string
    corridorName?: string
  }
}

export interface ActivePool {
  id: string
  corridorId?: string | null
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
    fareBreakdown?: FareBreakdown | null
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

export async function apiCancelRide(rideId: string) {
  const { data } = await apiClient.post<{ success: boolean; ride: RideRequest }>(`/rides/${rideId}/cancel`)
  return data.ride
}

export async function apiGetMyRides() {
  const { data } = await apiClient.get<{ rides: RideRequest[] }>('/rides/my-rides')
  return data.rides
}

export async function apiGetActiveRides() {
  const { data } = await apiClient.get<ActiveRidesResponse>('/rides/active')
  return data
}

// ─── Shareable Rides (Browse) ─────────────────────────────────────────────────

export interface ShareableRider {
  destinationZone: Zone
  seats: number
  passenger?: { id: string; name: string } | null
}

export interface ShareableRide {
  poolId: string
  pickupZone: Zone
  stage: string
  seatsTaken: number
  seatsCap: number
  seatsAvailable: number
  riders: ShareableRider[]
}

export interface ShareableRidesResponse {
  rides: ShareableRide[]
}

export async function apiGetShareableRides(search?: string): Promise<ShareableRide[]> {
  const params = search ? { search } : {}
  const { data } = await apiClient.get<{ rides: ShareableRide[] }>('/rides/shareable', { params })
  return data.rides
}

export async function apiJoinPool(
  poolId: string,
  body: { destinationZone: Zone; seats: number }
) {
  const { data } = await apiClient.post<RideRequest>(`/rides/${poolId}/join`, body)
  return data
}

export async function apiRequestRideWithShare(body: {
  pickupZone: Zone
  destinationZone: Zone
  seats: number
  openToShare: boolean
  maxShareSeats?: number
}) {
  const { data } = await apiClient.post<RideRequest>('/rides/request', body)
  return data
}

// ─── User Profiles & Reviews ─────────────────────────────────────────────────

export interface DriverProfile {
  id: string
  name: string
  role: 'DRIVER'
  memberSince: string
  tesla: { id: string; name: string; plate: string; capacity: number } | null
  averageRating: number | null
  reviewCount: number
  totalCompletedRides: number
}

export interface PassengerProfile {
  id: string
  name: string
  role: 'PASSENGER'
  memberSince: string
  totalRidesTaken: number
}

export type UserProfile = DriverProfile | PassengerProfile

export interface Review {
  id: string
  rideRequestId: string
  passengerId: string
  driverId: string
  rating: number
  comment?: string | null
  createdAt: string
}

export async function apiGetUserProfile(userId: string): Promise<UserProfile> {
  const { data } = await apiClient.get<UserProfile>(`/users/${userId}/profile`)
  return data
}

export async function apiSubmitReview(
  rideRequestId: string,
  body: { rating: number; comment?: string }
): Promise<Review> {
  const { data } = await apiClient.post<Review>(`/rides/${rideRequestId}/review`, body)
  return data
}

export async function apiDriverAccept(poolId: string) {
  const { data } = await apiClient.post(`/driver/${poolId}/accept`)
  return data
}

export async function apiDriverArrived(poolId: string) {
  const { data } = await apiClient.post(`/driver/${poolId}/arrived`)
  return data
}

export async function apiDriverComplete(poolId: string) {
  const { data } = await apiClient.post(`/driver/${poolId}/complete`)
  return data
}

