'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import Navbar from '@/components/navbar'
import FareEstimator from '@/components/passenger/fare-estimator'
import MyRides from '@/components/passenger/my-rides'
import BrowseSharedRides from '@/components/passenger/browse-shared-rides'
import ActivePools from '@/components/driver/active-pools'
import { cn } from '@/lib/utils'
import { Zap, Car, Users, Shield, TrendingDown, ChevronRight, Loader2, Search } from 'lucide-react'

type PassengerTab = 'estimate' | 'rides' | 'browse'

export default function Home() {
  const { role, isLoading } = useAuth()
  const [passengerTab, setPassengerTab] = useState<PassengerTab>('estimate')

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-[#090d16] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #00ff9d)' }}>
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
        <section className="mb-10">
          <div className="relative overflow-hidden rounded-3xl border border-[#1f2d44]/40"
            style={{
              background: 'radial-gradient(ellipse at 30% 40%, rgba(0,212,255,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 70%, rgba(0,255,157,0.06) 0%, transparent 60%), #0f1521',
            }}>
            <div className="scan-bg absolute inset-0 opacity-40 pointer-events-none" />
            <div className="relative px-6 py-10 sm:px-10 sm:py-14 lg:py-16">
              <div className="max-w-2xl">
                <div className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-5 border',
                  isPassenger
                    ? 'text-[#00d4ff] bg-[#00d4ff]/10 border-[#00d4ff]/30'
                    : 'text-[#00ff9d] bg-[#00ff9d]/10 border-[#00ff9d]/30'
                )}>
                  {isPassenger ? <Users className="w-3.5 h-3.5" /> : <Car className="w-3.5 h-3.5" />}
                  {isPassenger ? 'Passenger Mode' : 'Tesla Owner / Driver Mode'}
                </div>

                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#f0f4ff] leading-tight mb-4">
                  {isPassenger ? (
                    <>Smart EV Pooling<br /><span className="gradient-text">Across Dhaka</span></>
                  ) : (
                    <>Drive. Earn.<br /><span className="gradient-text">Build Dhaka&apos;s Future.</span></>
                  )}
                </h1>

                <p className="text-[#8ba3c7] text-base sm:text-lg leading-relaxed mb-6">
                  {isPassenger
                    ? 'Book affordable Tesla rides across Dhaka. Pool with others and save up to 45% on every trip — sustainable, silent, and on-demand.'
                    : 'Accept pool requests along your route. Earn more per trip by carrying multiple passengers. Zero emissions, maximum impact.'
                  }
                </p>

                <div className="flex flex-wrap gap-2">
                  {isPassenger ? (
                    <>
                      <FeatureChip icon={<TrendingDown className="w-3.5 h-3.5" />} text="Up to 45% off with pooling" />
                      <FeatureChip icon={<Zap className="w-3.5 h-3.5" />} text="Instant fare estimate" />
                      <FeatureChip icon={<Shield className="w-3.5 h-3.5" />} text="5 Dhaka zones" />
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
          Dhaka Tesla Pool MVP · Built with Next.js 14 &amp; Fastify ·{' '}
          <span className="gradient-text font-semibold">Zero Emissions</span>
        </p>
      </footer>
    </div>
  )
}

// ── Passenger view ─────────────────────────────────────────────────────────

function PassengerView({ tab, onTabChange }: { tab: PassengerTab; onTabChange: (t: PassengerTab) => void }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-3 space-y-5">
        {/* Tab switcher */}
        <div className="flex bg-[#161e2e]/60 backdrop-blur-sm border border-[#1f2d44]/40 rounded-2xl p-1.5 gap-1.5">
          {[
            { id: 'estimate' as const, label: 'Request',  icon: <Zap className="w-4 h-4" /> },
            { id: 'browse'   as const, label: 'Browse',   icon: <Search className="w-4 h-4" /> },
            { id: 'rides'    as const, label: 'My Rides', icon: <Car className="w-4 h-4" /> },
          ].map(({ id, label, icon }) => (
            <button key={id} onClick={() => onTabChange(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200',
                tab === id ? 'text-[#090d16] shadow-md' : 'text-[#8ba3c7] hover:text-[#f0f4ff]'
              )}
              style={tab === id ? { background: 'linear-gradient(135deg, #00d4ff, #00ff9d)' } : {}}>
              {icon}{label}
            </button>
          ))}
        </div>
        {tab === 'estimate' ? <FareEstimator /> : tab === 'browse' ? <BrowseSharedRides /> : <MyRides />}
      </div>

      {/* Sidebar */}
      <div className="lg:col-span-2 space-y-4">
        <div className="glass-card p-5">
          <h3 className="text-xs font-semibold text-[#4d6080] uppercase tracking-wider mb-4">Dhaka Coverage Zones</h3>
          <div className="space-y-2">
            {[
              { zone: 'GULSHAN',   desc: 'Business & Diplomatic hub',   emoji: '🏢' },
              { zone: 'BANANI',    desc: 'Upscale residential & cafes',  emoji: '🌿' },
              { zone: 'DHANMONDI', desc: 'University & residential',      emoji: '🎓' },
              { zone: 'UTTARA',    desc: 'Airport & modern suburb',       emoji: '✈️' },
              { zone: 'MOTIJHEEL', desc: 'Financial & commercial',        emoji: '🏦' },
            ].map(({ zone, desc, emoji }) => (
              <div key={zone} className="flex items-center gap-3 py-2 border-b border-[#1f2d44]/20 last:border-0">
                <span className="text-lg shrink-0">{emoji}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#f0f4ff]">{zone}</p>
                  <p className="text-xs text-[#4d6080] truncate">{desc}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-[#4d6080] ml-auto shrink-0" />
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-xs font-semibold text-[#4d6080] uppercase tracking-wider mb-4">Pool Discount Matrix</h3>
          <div className="space-y-2.5">
            {[
              { riders: 1, discount: 0,  color: 'text-[#8ba3c7]' },
              { riders: 2, discount: 30, color: 'text-[#00d4ff]' },
              { riders: 3, discount: 45, color: 'text-[#00ff9d]' },
            ].map(({ riders, discount, color }) => (
              <div key={riders} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {Array.from({ length: riders }).map((_, i) => (
                      <Users key={i} className={cn('w-3.5 h-3.5', color)} style={{ marginLeft: i > 0 ? '-2px' : 0 }} />
                    ))}
                  </div>
                  <span className="text-sm text-[#8ba3c7]">{riders} {riders === 1 ? 'rider' : 'riders'}</span>
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
  )
}

// ── Driver view ─────────────────────────────────────────────────────────────

function DriverView() {
  return (
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
              { tip: 'Gulshan ↔ Dhanmondi is the busiest route',   icon: '🔥' },
              { tip: 'Uttara route earns more due to distance',     icon: '✈️' },
              { tip: 'Accept early — pools fill up fast',           icon: '⚡' },
            ].map(({ tip, icon }, i) => (
              <div key={i} className="flex items-start gap-2.5 text-sm">
                <span className="text-base shrink-0">{icon}</span>
                <p className="text-[#8ba3c7] leading-snug">{tip}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-5">
          <h3 className="text-xs font-semibold text-[#4d6080] uppercase tracking-wider mb-4">Fare Reference (1 Rider)</h3>
          <div className="space-y-0 text-xs">
            {[
              { route: 'Gulshan → Banani',    km: 3,  fare: 190 },
              { route: 'Gulshan → Dhanmondi', km: 10, fare: 400 },
              { route: 'Gulshan → Uttara',    km: 12, fare: 460 },
              { route: 'Uttara → Motijheel',  km: 20, fare: 700 },
              { route: 'Dhanmondi → Motijheel', km: 6, fare: 280 },
            ].map(({ route, km, fare }) => (
              <div key={route} className="flex items-center justify-between py-2 border-b border-[#1f2d44]/20 last:border-0">
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
  )
}

function FeatureChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1c2740]/60 border border-[#1f2d44]/40 text-xs text-[#8ba3c7] font-medium">
      <span className="text-[#00d4ff]">{icon}</span>{text}
    </div>
  )
}
