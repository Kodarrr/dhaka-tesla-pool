'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import Navbar from '@/components/navbar'
import FareEstimator from '@/components/passenger/fare-estimator'
import MyRides from '@/components/passenger/my-rides'
import BrowseSharedRides from '@/components/passenger/browse-shared-rides'
import ActivePools from '@/components/driver/active-pools'
import StaticRouteMap from '@/components/static-route-map'
import { cn } from '@/lib/utils'
import {
  Zap,
  Car,
  Users,
  Shield,
  TrendingDown,
  ChevronRight,
  Loader2,
  Search,
  Map,
} from 'lucide-react'

type PassengerTab = 'estimate' | 'browse' | 'rides' | 'map'

export default function Home() {
  const { role, isLoading } = useAuth()
  const [passengerTab, setPassengerTab] = useState<PassengerTab>('estimate')

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-[#090d16] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #00ff9d)' }}
          >
            <Zap className="w-6 h-6 text-[#090d16]" strokeWidth={2.5} />
          </div>
          <Loader2 className="w-5 h-5 text-[#00d4ff] animate-spin" />
          <p className="text-sm text-[#4d6080]">Loading Dhaka Tesla Pool…</p>
        </div>
      </div>
    )
  }

  const isPassenger = role !== 'DRIVER'

  return (
    <div className="min-h-dvh bg-[#090d16]">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        {/* ── Hero ──────────────────────────────────────────────── */}
        <section className="mb-8">
          <div
            className="relative overflow-hidden rounded-3xl border border-[#1f2d44]/40"
            style={{
              background:
                'radial-gradient(ellipse at 30% 40%, rgba(0,212,255,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(0,255,157,0.06) 0%, transparent 60%), #0f1521',
            }}
          >
            <div className="scan-bg absolute inset-0 opacity-40 pointer-events-none" />
            <div className="relative px-6 py-8 sm:px-10 sm:py-12 lg:py-14">
              <div className="max-w-2xl">
                <div
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4 border',
                    isPassenger
                      ? 'text-[#00d4ff] bg-[#00d4ff]/10 border-[#00d4ff]/30'
                      : 'text-[#00ff9d] bg-[#00ff9d]/10 border-[#00ff9d]/30'
                  )}
                >
                  {isPassenger ? <Users className="w-3.5 h-3.5" /> : <Car className="w-3.5 h-3.5" />}
                  {isPassenger ? 'Passenger Mode' : 'Tesla Owner / Driver Mode'}
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#f0f4ff] leading-tight mb-3">
                  {isPassenger ? (
                    <>
                      Smart EV Pooling
                      <br />
                      <span className="gradient-text">Across Dhaka</span>
                    </>
                  ) : (
                    <>
                      Drive. Earn.
                      <br />
                      <span className="gradient-text">Build Dhaka&apos;s Future.</span>
                    </>
                  )}
                </h1>

                <p className="text-[#8ba3c7] text-sm sm:text-base leading-relaxed mb-5">
                  {isPassenger
                    ? 'Book affordable Tesla rides across Dhaka. Pool with others and save up to 45% on every trip — sustainable, silent, and on-demand.'
                    : 'Accept pool requests along your route. Earn more per trip by carrying multiple passengers. Zero emissions, maximum impact.'}
                </p>

                <div className="flex flex-wrap gap-2">
                  {isPassenger ? (
                    <>
                      <FeatureChip icon={<TrendingDown className="w-3.5 h-3.5" />} text="Up to 45% off with pooling" />
                      <FeatureChip icon={<Zap className="w-3.5 h-3.5" />} text="Instant fare estimate" />
                      <FeatureChip icon={<Shield className="w-3.5 h-3.5" />} text="7 Dhaka coverage zones" />
                    </>
                  ) : (
                    <>
                      <FeatureChip icon={<Car className="w-3.5 h-3.5" />} text="Accept on your route" />
                      <FeatureChip icon={<Zap className="w-3.5 h-3.5" />} text="Real-time pool feed" />
                      <FeatureChip icon={<Shield className="w-3.5 h-3.5" />} text="Earn per passenger" />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Role views ────────────────────────────────────────── */}
        {isPassenger ? (
          <PassengerView tab={passengerTab} onTabChange={setPassengerTab} />
        ) : (
          <DriverView />
        )}
      </main>

      <footer className="border-t border-[#1f2d44]/30 py-6 px-4 text-center">
        <p className="text-xs text-[#4d6080]">
          Dhaka Tesla Pool · Built with Next.js 14 &amp; Fastify ·{' '}
          <span className="gradient-text font-semibold">Zero Emissions</span>
        </p>
      </footer>
    </div>
  )
}

// ── Passenger view ─────────────────────────────────────────────────────────

function PassengerView({
  tab,
  onTabChange,
}: {
  tab: PassengerTab
  onTabChange: (t: PassengerTab) => void
}) {
  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex bg-[#161e2e]/70 backdrop-blur-md border border-[#1f2d44]/50 rounded-2xl p-1.5 gap-1.5 max-w-xl">
        {[
          { id: 'estimate' as const, label: 'Request', icon: <Zap className="w-4 h-4" /> },
          { id: 'browse' as const, label: 'Browse Pools', icon: <Search className="w-4 h-4" /> },
          { id: 'rides' as const, label: 'My Rides', icon: <Car className="w-4 h-4" /> },
          { id: 'map' as const, label: 'Route Map', icon: <Map className="w-4 h-4" /> },
        ].map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200',
              tab === id ? 'text-[#090d16] shadow-md font-bold' : 'text-[#8ba3c7] hover:text-[#f0f4ff]'
            )}
            style={tab === id ? { background: 'linear-gradient(135deg, #00d4ff, #00ff9d)' } : {}}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* When Static Route Map is selected, render full-width */}
      {tab === 'map' ? (
        <StaticRouteMap />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-5">
            {tab === 'estimate' ? <FareEstimator /> : tab === 'browse' ? <BrowseSharedRides /> : <MyRides />}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-[#4d6080] uppercase tracking-wider">
                  Dhaka Coverage Zones (7)
                </h3>
                <button
                  type="button"
                  onClick={() => onTabChange('map')}
                  className="text-[11px] font-semibold text-[#00d4ff] hover:underline flex items-center gap-0.5"
                >
                  View Map <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-1.5">
                {[
                  { zone: 'UTTARA', desc: 'Airport & northern suburb hub', emoji: '✈️' },
                  { zone: 'BANANI', desc: 'Upscale residential & dining', emoji: '🌿' },
                  { zone: 'MOHAKHALI', desc: 'Central transit intersection', emoji: '🛣️' },
                  { zone: 'GULSHAN', desc: 'Diplomatic & corporate district', emoji: '🏢' },
                  { zone: 'BASHUNDHARA', desc: 'North-East residential & campus', emoji: '🏡' },
                  { zone: 'DHANMONDI', desc: 'South-West academic & cultural', emoji: '🎓' },
                  { zone: 'MOTIJHEEL', desc: 'Southern financial & trade hub', emoji: '🏦' },
                ].map(({ zone, desc, emoji }) => (
                  <div
                    key={zone}
                    onClick={() => onTabChange('map')}
                    className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-[#162032]/60 cursor-pointer transition-colors border-b border-[#1f2d44]/15 last:border-0"
                  >
                    <span className="text-base shrink-0">{emoji}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#f0f4ff]">{zone}</p>
                      <p className="text-[11px] text-[#4d6080] truncate">{desc}</p>
                    </div>
                    <ChevronRight className="w-3 h-3 text-[#4d6080] shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-5">
              <h3 className="text-xs font-semibold text-[#4d6080] uppercase tracking-wider mb-4">
                Pool Discount Matrix
              </h3>
              <div className="space-y-2.5">
                {[
                  { riders: 1, discount: 0, color: 'text-[#8ba3c7]' },
                  { riders: 2, discount: 30, color: 'text-[#00d4ff]' },
                  { riders: 3, discount: 45, color: 'text-[#00ff9d]' },
                ].map(({ riders, discount, color }) => (
                  <div key={riders} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex">
                        {Array.from({ length: riders }).map((_, i) => (
                          <Users
                            key={i}
                            className={cn('w-3.5 h-3.5', color)}
                            style={{ marginLeft: i > 0 ? '-2px' : 0 }}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-[#8ba3c7]">
                        {riders} {riders === 1 ? 'rider' : 'riders'}
                      </span>
                    </div>
                    <span className={cn('text-sm font-bold', color)}>
                      {discount === 0 ? 'Base fare' : `-${discount}% off`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card-sm p-4 flex items-center gap-3">
              <div className="dot-online shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#8ba3c7]">Backend API</p>
                <p className="text-xs text-[#4d6080] truncate">localhost:8000/api/v1</p>
              </div>
              <div className="ml-auto text-xs text-[#00ff9d] font-semibold shrink-0">Live</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Driver view ─────────────────────────────────────────────────────────────

function DriverView() {
  const [driverTab, setDriverTab] = useState<'pools' | 'map'>('pools')

  return (
    <div className="space-y-6">
      {/* Driver Tab Switcher */}
      <div className="flex bg-[#161e2e]/70 backdrop-blur-md border border-[#1f2d44]/50 rounded-2xl p-1.5 gap-1.5 max-w-sm">
        <button
          type="button"
          onClick={() => setDriverTab('pools')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200',
            driverTab === 'pools' ? 'text-[#090d16] shadow-md font-bold' : 'text-[#8ba3c7] hover:text-[#f0f4ff]'
          )}
          style={driverTab === 'pools' ? { background: 'linear-gradient(135deg, #00d4ff, #00ff9d)' } : {}}
        >
          <Car className="w-4 h-4" /> Active Pools
        </button>
        <button
          type="button"
          onClick={() => setDriverTab('map')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200',
            driverTab === 'map' ? 'text-[#090d16] shadow-md font-bold' : 'text-[#8ba3c7] hover:text-[#f0f4ff]'
          )}
          style={driverTab === 'map' ? { background: 'linear-gradient(135deg, #00d4ff, #00ff9d)' } : {}}
        >
          <Map className="w-4 h-4" /> Route Map
        </button>
      </div>

      {driverTab === 'map' ? (
        <StaticRouteMap />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <ActivePools />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <div className="glass-card p-5">
              <h3 className="text-xs font-semibold text-[#4d6080] uppercase tracking-wider mb-4">Earnings Guide</h3>
              <div className="space-y-3">
                {[
                  { tip: 'Accept pools with 3 riders for max earnings', icon: '💰' },
                  { tip: 'Gulshan ↔ Dhanmondi is the busiest route', icon: '🔥' },
                  { tip: 'Uttara route earns more due to distance', icon: '✈️' },
                  { tip: 'Accept early — pools fill up fast', icon: '⚡' },
                ].map(({ tip, icon }, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <span className="text-base shrink-0">{icon}</span>
                    <p className="text-[#8ba3c7] leading-snug">{tip}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-5">
              <h3 className="text-xs font-semibold text-[#4d6080] uppercase tracking-wider mb-4">
                Fare Reference (1 Rider)
              </h3>
              <div className="space-y-0 text-xs">
                {[
                  { route: 'Gulshan → Banani', km: 3, fare: 190 },
                  { route: 'Gulshan → Dhanmondi', km: 10, fare: 400 },
                  { route: 'Gulshan → Uttara', km: 12, fare: 460 },
                  { route: 'Uttara → Motijheel', km: 20, fare: 700 },
                  { route: 'Dhanmondi → Motijheel', km: 6, fare: 280 },
                ].map(({ route, km, fare }) => (
                  <div
                    key={route}
                    className="flex items-center justify-between py-2 border-b border-[#1f2d44]/20 last:border-0"
                  >
                    <div>
                      <p className="text-[#8ba3c7]">{route}</p>
                      <p className="text-[#4d6080]">{km} km</p>
                    </div>
                    <p className="font-semibold text-[#00d4ff]">৳{fare}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FeatureChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1c2740]/60 border border-[#1f2d44]/40 text-xs text-[#8ba3c7] font-medium">
      <span className="text-[#00d4ff]">{icon}</span>
      {text}
    </div>
  )
}

