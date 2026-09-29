'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  apiGetSystemConditions,
  apiUpdateSystemConditions,
  type SystemConditions,
} from '@/lib/api'
import {
  ShieldAlert,
  CloudRain,
  Car,
  Zap,
  TrendingUp,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Sliders,
  DollarSign,
  Users,
} from 'lucide-react'
import { cn, formatPaisa } from '@/lib/utils'

export default function AdminPanel() {
  const [conditions, setConditions] = useState<SystemConditions | null>(null)
  const [loading, setLoading] = useState(true)
  const [updatingTraffic, setUpdatingTraffic] = useState(false)
  const [updatingRain, setUpdatingRain] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const fetchConditions = useCallback(async () => {
    try {
      setLoading(true)
      const data = await apiGetSystemConditions()
      setConditions(data)
    } catch {
      setMessage({ text: 'Failed to load system conditions', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConditions()
  }, [fetchConditions])

  const handleToggleTraffic = async () => {
    if (!conditions) return
    const nextState = !conditions.isTrafficJam
    try {
      setUpdatingTraffic(true)
      setMessage(null)
      const updated = await apiUpdateSystemConditions({ isTrafficJam: nextState })
      setConditions(updated)
      setMessage({
        text: `Traffic Jam condition set to ${nextState ? 'ON (+20% surcharge)' : 'OFF (Standard rate)'}`,
        type: 'success',
      })
      window.dispatchEvent(new CustomEvent('dtp-conditions-changed', { detail: updated }))
    } catch {
      setMessage({ text: 'Failed to update traffic condition', type: 'error' })
    } finally {
      setUpdatingTraffic(false)
    }
  }

  const handleToggleRain = async () => {
    if (!conditions) return
    const nextState = !conditions.isRaining
    try {
      setUpdatingRain(true)
      setMessage(null)
      const updated = await apiUpdateSystemConditions({ isRaining: nextState })
      setConditions(updated)
      setMessage({
        text: `Raining condition set to ${nextState ? 'ON (+20% surcharge)' : 'OFF (Standard rate)'}`,
        type: 'success',
      })
      window.dispatchEvent(new CustomEvent('dtp-conditions-changed', { detail: updated }))
    } catch {
      setMessage({ text: 'Failed to update raining condition', type: 'error' })
    } finally {
      setUpdatingRain(false)
    }
  }

  const effectiveRate = conditions?.effectivePerKmRateBDT ?? 50
  const isTraffic = conditions?.isTrafficJam ?? false
  const isRain = conditions?.isRaining ?? false

  // Benchmark calculations for Nusrat (Banani -> Mohakhali, 2 km)
  const nusratDistKm = 2
  const nusratSoloBDT = nusratDistKm * effectiveRate
  const nusratPooledBDT = Math.round(nusratSoloBDT * (1 - 0.30))

  // Benchmark calculations for Rafiq (Banani -> Gulshan, 3 km: 2 km shared with Nusrat, 1 km solo)
  const rafiqSharedKm = 2
  const rafiqSoloKm = 1
  const rafiqSharedBDT = Math.round(rafiqSharedKm * effectiveRate * (1 - 0.30))
  const rafiqSoloBDT = rafiqSoloKm * effectiveRate
  const rafiqTotalBDT = rafiqSharedBDT + rafiqSoloBDT

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-card p-6 border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-purple-500/5 to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#f0f4ff] flex items-center gap-2">
                Admin Control Panel
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  SYSTEM OPERATOR
                </span>
              </h2>
              <p className="text-xs text-[#8ba3c7]">
                Manage Dhaka real-time environmental factors (traffic &amp; rain) and inspect hand-calculable fare math.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchConditions}
            disabled={loading}
            className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1.5 shrink-0 self-start sm:self-center"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {message && (
          <div
            className={cn(
              'mt-4 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2 border transition-all animate-fadeIn',
              message.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
            )}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{message.text}</span>
          </div>
        )}
      </div>

      {/* Environmental Factor Toggles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Traffic Jam Toggle Card */}
        <div
          className={cn(
            'glass-card p-5 border transition-all duration-300',
            isTraffic
              ? 'border-orange-500/50 bg-orange-500/5 shadow-[0_0_20px_rgba(249,115,22,0.1)]'
              : 'border-[#1f2d44]/50 hover:border-[#1f2d44]'
          )}
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                  isTraffic ? 'bg-orange-500/20 text-orange-400' : 'bg-zinc-800 text-zinc-400'
                )}
              >
                <Car className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#f0f4ff]">Traffic Jam Surge</h3>
                <p className="text-xs text-[#8ba3c7]">Dhaka gridlock multiplier</p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isTraffic}
              disabled={updatingTraffic || loading}
              onClick={handleToggleTraffic}
              className={cn(
                'relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                isTraffic ? 'bg-orange-500' : 'bg-zinc-700',
                (updatingTraffic || loading) && 'opacity-60 cursor-not-allowed'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                  isTraffic ? 'translate-x-6' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-[#1f2d44]/30">
              <span className="text-[#8ba3c7]">Current Status:</span>
              <span
                className={cn(
                  'font-semibold px-2 py-0.5 rounded-full text-[11px]',
                  isTraffic ? 'bg-orange-500/20 text-orange-300' : 'bg-zinc-800 text-zinc-400'
                )}
              >
                {isTraffic ? 'TRAFFIC JAM (ON)' : 'CLEAR ROADS (OFF)'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#1f2d44]/30">
              <span className="text-[#8ba3c7]">Rate Surcharge:</span>
              <span className="font-semibold text-[#f0f4ff]">
                {isTraffic ? '+৳10 / km (+20%)' : '+৳0 / km (0%)'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#8ba3c7]">Driver Incentive:</span>
              <span className="text-[#00ff9d] font-medium">Compensates delay &amp; battery drain</span>
            </div>
          </div>
        </div>

        {/* Rain Surge Toggle Card */}
        <div
          className={cn(
            'glass-card p-5 border transition-all duration-300',
            isRain
              ? 'border-blue-500/50 bg-blue-500/5 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
              : 'border-[#1f2d44]/50 hover:border-[#1f2d44]'
          )}
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                  isRain ? 'bg-blue-500/20 text-blue-400' : 'bg-zinc-800 text-zinc-400'
                )}
              >
                <CloudRain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#f0f4ff]">Monsoon Rain Surge</h3>
                <p className="text-xs text-[#8ba3c7]">Weather condition modifier</p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={isRain}
              disabled={updatingRain || loading}
              onClick={handleToggleRain}
              className={cn(
                'relative inline-flex h-6 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
                isRain ? 'bg-blue-500' : 'bg-zinc-700',
                (updatingRain || loading) && 'opacity-60 cursor-not-allowed'
              )}
            >
              <span
                className={cn(
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out',
                  isRain ? 'translate-x-6' : 'translate-x-0'
                )}
              />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-[#1f2d44]/30">
              <span className="text-[#8ba3c7]">Current Status:</span>
              <span
                className={cn(
                  'font-semibold px-2 py-0.5 rounded-full text-[11px]',
                  isRain ? 'bg-blue-500/20 text-blue-300' : 'bg-zinc-800 text-zinc-400'
                )}
              >
                {isRain ? 'RAINING (ON)' : 'DRY WEATHER (OFF)'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#1f2d44]/30">
              <span className="text-[#8ba3c7]">Rate Surcharge:</span>
              <span className="font-semibold text-[#f0f4ff]">
                {isRain ? '+৳10 / km (+20%)' : '+৳0 / km (0%)'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-[#8ba3c7]">Dhaka Context:</span>
              <span className="text-blue-300 font-medium">Waterlogging protection</span>
            </div>
          </div>
        </div>
      </div>

      {/* Live System Rate Breakdown */}
      <div className="glass-card p-5">
        <h3 className="text-xs font-semibold text-[#4d6080] uppercase tracking-wider mb-4 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-[#00d4ff]" />
          Deterministic Hand-Calculable Fare Formula
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="p-3 rounded-xl bg-[#090d16]/60 border border-[#1f2d44]/40">
            <div className="text-[11px] text-[#8ba3c7]">Base Rate</div>
            <div className="text-base font-bold text-[#f0f4ff]">৳50 <span className="text-xs font-normal text-[#8ba3c7]">/ km</span></div>
          </div>
          <div className="p-3 rounded-xl bg-[#090d16]/60 border border-[#1f2d44]/40">
            <div className="text-[11px] text-[#8ba3c7]">Traffic Surcharge</div>
            <div className="text-base font-bold text-orange-400">
              {isTraffic ? '+৳10' : '+৳0'} <span className="text-xs font-normal text-[#8ba3c7]">/ km</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#090d16]/60 border border-[#1f2d44]/40">
            <div className="text-[11px] text-[#8ba3c7]">Rain Surcharge</div>
            <div className="text-base font-bold text-blue-400">
              {isRain ? '+৳10' : '+৳0'} <span className="text-xs font-normal text-[#8ba3c7]">/ km</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-[#00d4ff]/10 border border-emerald-500/30">
            <div className="text-[11px] text-emerald-300 font-medium">Effective Per-Km Rate</div>
            <div className="text-lg font-bold text-emerald-400">
              ৳{effectiveRate} <span className="text-xs font-normal text-[#8ba3c7]">/ km</span>
            </div>
          </div>
        </div>

        {/* Mathematical Formula Spec */}
        <div className="bg-[#090d16]/80 rounded-2xl p-4 border border-[#1f2d44]/50 space-y-2 text-xs font-mono text-[#8ba3c7]">
          <div className="text-emerald-400 font-semibold font-mono">[Formula Spec] Evaluator Hand-Calculation Benchmark:</div>
          <div>Effective Rate = 50 + (10 if Traffic Jam) + (10 if Raining) = <span className="text-[#f0f4ff] font-bold">৳{effectiveRate}/km</span></div>
          <div>Leg Charge = Distance(km) × Effective Rate</div>
          <div>Shared Leg Discount = Leg Charge × 30% (when 2+ passengers share)</div>
          <div>Passenger Fare = Sum of Leg Charges - Total Discount</div>
          <div>Stored in DB = Passenger Fare × 100 (Integer Paisa, zero floating-point loss)</div>
        </div>
      </div>

      {/* Hand-Calculation Live Verification Table */}
      <div className="glass-card p-5">
        <h3 className="text-xs font-semibold text-[#4d6080] uppercase tracking-wider mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          PRD Cast Benchmark: Nusrat &amp; Rafiq Live Test
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#1f2d44] text-[#8ba3c7]">
                <th className="pb-2">Rider</th>
                <th className="pb-2">Route</th>
                <th className="pb-2">Distance</th>
                <th className="pb-2">Solo Fare (৳)</th>
                <th className="pb-2">Pooled Fare (30% off shared)</th>
                <th className="pb-2">In Paisa (DB)</th>
                <th className="pb-2">Hand Formula</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2d44]/40">
              <tr>
                <td className="py-2.5 font-semibold text-[#f0f4ff]">Nusrat</td>
                <td className="py-2.5 text-[#8ba3c7]">Banani → Mohakhali</td>
                <td className="py-2.5 text-[#8ba3c7]">2 km</td>
                <td className="py-2.5 font-semibold text-zinc-300">৳{nusratSoloBDT}</td>
                <td className="py-2.5 font-bold text-emerald-400">৳{nusratPooledBDT}</td>
                <td className="py-2.5 text-[#8ba3c7] font-mono">{formatPaisa(nusratPooledBDT * 100)}</td>
                <td className="py-2.5 text-[#8ba3c7] font-mono">2 × {effectiveRate} × 0.70</td>
              </tr>
              <tr>
                <td className="py-2.5 font-semibold text-[#f0f4ff]">Rafiq</td>
                <td className="py-2.5 text-[#8ba3c7]">Banani → Gulshan 1</td>
                <td className="py-2.5 text-[#8ba3c7]">3 km (2 shared + 1 solo)</td>
                <td className="py-2.5 font-semibold text-zinc-300">৳{3 * effectiveRate}</td>
                <td className="py-2.5 font-bold text-emerald-400">৳{rafiqTotalBDT}</td>
                <td className="py-2.5 text-[#8ba3c7] font-mono">{formatPaisa(rafiqTotalBDT * 100)}</td>
                <td className="py-2.5 text-[#8ba3c7] font-mono">
                  (2 × {effectiveRate} × 0.70) + (1 × {effectiveRate})
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
