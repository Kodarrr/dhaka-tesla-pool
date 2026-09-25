'use client'

import { cn } from '@/lib/utils'
import { Check, Car } from 'lucide-react'

const CORRIDOR_ZONES: Record<string, string[]> = {
  CORRIDOR_AIRPORT_ROAD: ['UTTARA', 'BANANI', 'MOHAKHALI', 'GULSHAN', 'BASHUNDHARA'],
  CORRIDOR_AIRPORT_ROAD_NORTH: ['BASHUNDHARA', 'GULSHAN', 'MOHAKHALI', 'BANANI', 'UTTARA'],
  CORRIDOR_NORTH_SOUTH: ['UTTARA', 'BANANI', 'MOHAKHALI', 'MOTIJHEEL'],
  CORRIDOR_NORTH_SOUTH_NORTH: ['MOTIJHEEL', 'MOHAKHALI', 'BANANI', 'UTTARA'],
  CORRIDOR_WEST_EAST: ['DHANMONDI', 'MOHAKHALI', 'GULSHAN'],
  CORRIDOR_WEST_EAST_REV: ['GULSHAN', 'MOHAKHALI', 'DHANMONDI'],
}

interface RouteMapProps {
  pickupZone: string
  destinationZone?: string
  dropoffZones?: string[]
  corridorId?: string | null
  stage?: string
  currentZone?: string | null
  targetZone?: string | null
  coveredZones?: string[]
  remainingSeconds?: number | null
  waitingMessage?: string | null
  className?: string
}

export default function RouteMap({
  pickupZone,
  destinationZone,
  dropoffZones,
  corridorId,
  stage = 'REQUESTED',
  currentZone,
  targetZone,
  coveredZones = [],
  remainingSeconds,
  waitingMessage,
  className,
}: RouteMapProps) {
  // Derive list of zones to display (starting strictly from pickupZone)
  let zones: string[] = []

  const targetDestinations = dropoffZones && dropoffZones.length > 0
    ? dropoffZones
    : destinationZone
    ? [destinationZone]
    : []

  if (corridorId && CORRIDOR_ZONES[corridorId]) {
    const allCorridorZones = CORRIDOR_ZONES[corridorId]
    const pIdx = allCorridorZones.indexOf(pickupZone)

    if (pIdx !== -1) {
      if (targetDestinations.length > 0) {
        // Find maximum destination index in corridor
        const destIndices = targetDestinations
          .map((d) => allCorridorZones.indexOf(d))
          .filter((idx) => idx !== -1)

        const maxDIdx = destIndices.length > 0 ? Math.max(...destIndices) : allCorridorZones.length - 1
        zones = allCorridorZones.slice(pIdx, Math.max(maxDIdx + 1, pIdx + 1))
      } else {
        zones = allCorridorZones.slice(pIdx)
      }
    } else {
      zones = allCorridorZones
    }
  }

  if (zones.length === 0) {
    zones = targetDestinations.length > 0
      ? [pickupZone, ...targetDestinations.filter((d) => d !== pickupZone)]
      : [pickupZone]
  }

  // Ensure unique consecutive zones
  zones = zones.filter((z, idx, arr) => idx === 0 || z !== arr[idx - 1])

  const isCompleted = stage === 'COMPLETED'
  const effectiveCurrentZone = currentZone || (isCompleted ? zones[zones.length - 1] : pickupZone)
  const currentIdx = Math.max(0, zones.indexOf(effectiveCurrentZone))

  return (
    <div className={cn('py-2 px-1 space-y-3', className)}>
      {/* Simulation status banner if active */}
      {(remainingSeconds !== undefined && remainingSeconds !== null && targetZone) ? (
        <div className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-[#00d4ff]/10 border border-[#00d4ff]/30 text-[#00d4ff] animate-pulse">
          <span className="flex items-center gap-1.5 font-semibold">
            <Car className="w-3.5 h-3.5" />
            Driving to {targetZone}...
          </span>
          <span className="font-mono font-bold bg-[#00d4ff]/20 px-2 py-0.5 rounded text-[11px]">
            {remainingSeconds}s
          </span>
        </div>
      ) : waitingMessage ? (
        <div className="flex items-center gap-2 text-xs py-1.5 px-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
          <span className="font-medium">{waitingMessage}</span>
        </div>
      ) : null}

      {/* Horizontal route dots and line */}
      <div className="relative flex items-center justify-between px-2">
        {/* Background line */}
        <div className="absolute left-5 right-5 top-1/2 -translate-y-1/2 h-0.5 bg-[#1f2d44]" />

        {/* Progress covered line */}
        <div
          className="absolute left-5 top-1/2 -translate-y-1/2 h-0.5 transition-all duration-500 bg-gradient-to-r from-[#00d4ff] to-[#00ff9d]"
          style={{
            width: isCompleted
              ? 'calc(100% - 40px)'
              : zones.length > 1
              ? `calc((100% - 40px) * ${Math.max(0, currentIdx) / (zones.length - 1)})`
              : '0%',
          }}
        />

        {/* Zone markers */}
        {zones.map((zone, idx) => {
          const isPickup = idx === 0
          const isFinal = idx === zones.length - 1
          const isCovered = isCompleted || coveredZones.includes(zone) || idx <= currentIdx
          const isCurrent = zone === effectiveCurrentZone && !isCompleted

          return (
            <div
              key={`${zone}-${idx}`}
              className="relative z-10 flex flex-col items-center group"
            >
              {/* Dot / Indicator */}
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 border-2',
                  isCurrent
                    ? 'bg-[#00d4ff] border-[#00d4ff] ring-4 ring-[#00d4ff]/30 text-[#090d16] scale-110 shadow-lg shadow-[#00d4ff]/40'
                    : isCovered
                    ? 'bg-[#00ff9d] border-[#00ff9d] text-[#090d16]'
                    : 'bg-[#0a0e17] border-[#1f2d44] text-[#4d6080]'
                )}
              >
                {isCurrent ? (
                  <Car className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : isCovered ? (
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1f2d44]" />
                )}
              </div>

              {/* Label */}
              <span
                className={cn(
                  'mt-1.5 text-[10px] font-bold tracking-tight uppercase whitespace-nowrap transition-colors',
                  isCurrent
                    ? 'text-[#00d4ff]'
                    : isCovered
                    ? 'text-[#00ff9d]'
                    : isPickup
                    ? 'text-[#8ba3c7]'
                    : isFinal
                    ? 'text-[#f0f4ff]'
                    : 'text-[#4d6080]'
                )}
              >
                {zone}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
