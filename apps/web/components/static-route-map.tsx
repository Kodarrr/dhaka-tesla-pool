'use client'

import React, { useState } from 'react'
import { Zone, ZONES } from '@/lib/api'
import { ZONE_EMOJI, cn } from '@/lib/utils'
import {
  MapPin,
  Route,
  ArrowRight,
  Compass,
  Milestone,
  Layers,
  Info,
  ChevronRight,
  ArrowLeftRight,
} from 'lucide-react'

// Zone coordinates on a 800x520 SVG canvas approximating Dhaka geometry
interface ZoneCoord {
  zone: Zone
  name: string
  x: number
  y: number
  description: string
  isHub?: boolean
}

const ZONE_COORDS: Record<Zone, ZoneCoord> = {
  UTTARA: {
    zone: 'UTTARA',
    name: 'Uttara',
    x: 400,
    y: 60,
    description: 'Northern gateway · Airport & suburb hub',
  },
  BASHUNDHARA: {
    zone: 'BASHUNDHARA',
    name: 'Bashundhara R/A',
    x: 650,
    y: 170,
    description: 'North-East residential & university zone',
  },
  BANANI: {
    zone: 'BANANI',
    name: 'Banani',
    x: 350,
    y: 170,
    description: 'North-Central upscale commercial & dining hub',
  },
  GULSHAN: {
    zone: 'GULSHAN',
    name: 'Gulshan',
    x: 520,
    y: 260,
    description: 'Diplomatic enclave & corporate center',
  },
  MOHAKHALI: {
    zone: 'MOHAKHALI',
    name: 'Mohakhali',
    x: 350,
    y: 290,
    description: 'Central transit intersection & major crossroads',
    isHub: true,
  },
  DHANMONDI: {
    zone: 'DHANMONDI',
    name: 'Dhanmondi',
    x: 180,
    y: 380,
    description: 'South-West cultural & educational hub',
  },
  MOTIJHEEL: {
    zone: 'MOTIJHEEL',
    name: 'Motijheel',
    x: 430,
    y: 440,
    description: 'Southern financial & commercial district',
  },
}

// 2D distance matrix (same as fare engine)
const DISTANCES: Record<Zone, Partial<Record<Zone, number>>> = {
  UTTARA: { BANANI: 10, MOHAKHALI: 12, GULSHAN: 12, MOTIJHEEL: 23, BASHUNDHARA: 14, DHANMONDI: 18 },
  BANANI: { UTTARA: 10, MOHAKHALI: 2, GULSHAN: 3, MOTIJHEEL: 13, BASHUNDHARA: 6, DHANMONDI: 10 },
  MOHAKHALI: { BANANI: 2, GULSHAN: 1, DHANMONDI: 8, MOTIJHEEL: 9, UTTARA: 12, BASHUNDHARA: 7 },
  GULSHAN: { MOHAKHALI: 1, BANANI: 3, BASHUNDHARA: 5, DHANMONDI: 10, MOTIJHEEL: 11, UTTARA: 12 },
  BASHUNDHARA: { GULSHAN: 5, BANANI: 6, MOHAKHALI: 7, UTTARA: 14, DHANMONDI: 15, MOTIJHEEL: 16 },
  DHANMONDI: { MOHAKHALI: 8, GULSHAN: 10, BANANI: 10, MOTIJHEEL: 6, UTTARA: 18, BASHUNDHARA: 15 },
  MOTIJHEEL: { MOHAKHALI: 9, DHANMONDI: 6, GULSHAN: 11, BANANI: 13, UTTARA: 23, BASHUNDHARA: 16 },
}

interface CorridorDef {
  id: string
  name: string
  color: string
  bgLight: string
  stops: Zone[]
  distances: number[] // Distance of each adjacent leg
  description: string
}

const CORRIDOR_DEFS: CorridorDef[] = [
  {
    id: 'AIRPORT_ROAD',
    name: 'Airport Road Corridor',
    color: '#00d4ff',
    bgLight: 'rgba(0, 212, 255, 0.1)',
    stops: ['UTTARA', 'BANANI', 'MOHAKHALI', 'GULSHAN', 'BASHUNDHARA'],
    distances: [10, 2, 1, 5],
    description: 'Connects Northern Airport zone down to Mohakhali, Gulshan, and Bashundhara.',
  },
  {
    id: 'NORTH_SOUTH',
    name: 'North-South Arterial',
    color: '#00ff9d',
    bgLight: 'rgba(0, 255, 157, 0.1)',
    stops: ['UTTARA', 'BANANI', 'MOHAKHALI', 'MOTIJHEEL'],
    distances: [10, 2, 9],
    description: 'Direct North-to-South transit artery linking Uttara to the Motijheel financial district.',
  },
  {
    id: 'EAST_WEST',
    name: 'East-West Connector',
    color: '#a78bfa',
    bgLight: 'rgba(167, 139, 250, 0.1)',
    stops: ['DHANMONDI', 'MOHAKHALI', 'GULSHAN'],
    distances: [8, 1],
    description: 'Cross-city connector bridging Western universities and Eastern corporate offices.',
  },
]

export default function StaticRouteMap() {
  const [selectedZone, setSelectedZone] = useState<Zone>('MOHAKHALI')
  const [activeCorridorId, setActiveCorridorId] = useState<string | null>(null)

  const activeCorridor = CORRIDOR_DEFS.find((c) => c.id === activeCorridorId)

  // Determine which zones are before and after the selectedZone in each corridor
  const corridorSequences = CORRIDOR_DEFS.map((corridor) => {
    const idx = corridor.stops.indexOf(selectedZone)
    if (idx === -1) return null

    const before = corridor.stops.slice(0, idx)
    const after = corridor.stops.slice(idx + 1)

    return {
      corridor,
      index: idx,
      before,
      after,
    }
  }).filter(Boolean) as Array<{
    corridor: CorridorDef
    index: number
    before: Zone[]
    after: Zone[]
  }>

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="glass-card p-5 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-[#00d4ff]" />
              <h2 className="text-base font-bold text-[#f0f4ff] uppercase tracking-wider">
                Dhaka Tesla Pool · Static Route &amp; Zone Guide
              </h2>
            </div>
            <p className="text-xs text-[#8ba3c7] mt-1">
              Interactive reference map showing stop order, adjacent legs, and distances between all 7 Dhaka zones.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-[#4d6080] bg-[#161e2e] px-2.5 py-1 rounded-full border border-[#1f2d44]">
              7 Operational Zones
            </span>
            <span className="text-[11px] font-semibold text-[#00ff9d] bg-[#00ff9d]/10 px-2.5 py-1 rounded-full border border-[#00ff9d]/20">
              3 Primary Corridors
            </span>
          </div>
        </div>

        {/* Corridor Quick Selectors */}
        <div className="mt-4 pt-4 border-t border-[#1f2d44]/50 flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-[#4d6080] flex items-center gap-1">
            <Route className="w-3.5 h-3.5 text-[#00d4ff]" /> Corridors:
          </span>
          {CORRIDOR_DEFS.map((c) => {
            const isSelected = activeCorridorId === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCorridorId(isSelected ? null : c.id)}
                className={cn(
                  'text-xs px-3 py-1.5 rounded-xl font-medium border transition-all flex items-center gap-1.5',
                  isSelected
                    ? 'border-current shadow-lg'
                    : 'border-[#1f2d44] bg-[#0a0e17]/60 text-[#8ba3c7] hover:text-[#f0f4ff] hover:border-[#1f2d44]/80'
                )}
                style={isSelected ? { color: c.color, backgroundColor: c.bgLight, borderColor: c.color } : {}}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                <span>{c.name}</span>
              </button>
            )
          })}
          {activeCorridorId && (
            <button
              type="button"
              onClick={() => setActiveCorridorId(null)}
              className="text-[11px] text-[#4d6080] hover:text-[#8ba3c7] underline ml-2"
            >
              Reset corridor view
            </button>
          )}
        </div>
      </div>

      {/* Main Map Visual Canvas (SVG Subway / Transit Style) */}
      <div className="glass-card p-4 sm:p-6 relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-[#8ba3c7] mb-3">
          <span className="flex items-center gap-1 font-semibold text-[#f0f4ff]">
            <Milestone className="w-3.5 h-3.5 text-[#00ff9d]" /> Schematic Dhaka Transit Map
          </span>
          <span className="text-[11px] text-[#4d6080]">Click any zone to inspect order &amp; distances</span>
        </div>

        <div className="w-full overflow-x-auto bg-[#070b12] rounded-2xl border border-[#1f2d44]/60 p-2 sm:p-4">
          <svg
            viewBox="0 0 800 520"
            className="w-full h-auto min-w-[620px] max-h-[500px] select-none"
            style={{ filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.5))' }}
          >
            {/* Grid background dots */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="1" fill="#1c2740" />
              </pattern>
              <linearGradient id="corridor-airport" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00d4ff" />
                <stop offset="100%" stopColor="#00ff9d" />
              </linearGradient>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" opacity="0.6" />

            {/* Connecting Corridor Tracks */}
            {/* 1. Airport Road Track: Uttara -> Banani -> Mohakhali -> Gulshan -> Bashundhara */}
            <path
              d="M 400 60 L 350 170 L 350 290 L 520 260 L 650 170"
              fill="none"
              stroke="#00d4ff"
              strokeWidth={activeCorridorId === 'AIRPORT_ROAD' ? 6 : 3}
              strokeOpacity={activeCorridorId === null || activeCorridorId === 'AIRPORT_ROAD' ? 0.8 : 0.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />

            {/* 2. North-South Arterial Track: Uttara -> Banani -> Mohakhali -> Motijheel */}
            <path
              d="M 400 60 L 350 170 L 350 290 L 430 440"
              fill="none"
              stroke="#00ff9d"
              strokeWidth={activeCorridorId === 'NORTH_SOUTH' ? 6 : 3}
              strokeOpacity={activeCorridorId === null || activeCorridorId === 'NORTH_SOUTH' ? 0.8 : 0.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={activeCorridorId === 'NORTH_SOUTH' ? 'none' : '6 4'}
              className="transition-all duration-300"
            />

            {/* 3. East-West Track: Dhanmondi -> Mohakhali -> Gulshan */}
            <path
              d="M 180 380 L 350 290 L 520 260"
              fill="none"
              stroke="#a78bfa"
              strokeWidth={activeCorridorId === 'EAST_WEST' ? 6 : 3}
              strokeOpacity={activeCorridorId === null || activeCorridorId === 'EAST_WEST' ? 0.8 : 0.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />

            {/* Segment Distance Pill Badges on Tracks */}
            {/* Uttara -> Banani (10 km) */}
            <g transform="translate(385, 115)">
              <rect x="-24" y="-10" width="48" height="20" rx="10" fill="#090d16" stroke="#1f2d44" strokeWidth="1" />
              <text x="0" y="4" textAnchor="middle" fill="#8ba3c7" fontSize="10" fontWeight="bold">10 km</text>
            </g>

            {/* Banani -> Mohakhali (2 km) */}
            <g transform="translate(330, 230)">
              <rect x="-20" y="-10" width="40" height="20" rx="10" fill="#090d16" stroke="#1f2d44" strokeWidth="1" />
              <text x="0" y="4" textAnchor="middle" fill="#00d4ff" fontSize="10" fontWeight="bold">2 km</text>
            </g>

            {/* Mohakhali -> Gulshan (1 km) */}
            <g transform="translate(435, 265)">
              <rect x="-20" y="-10" width="40" height="20" rx="10" fill="#090d16" stroke="#1f2d44" strokeWidth="1" />
              <text x="0" y="4" textAnchor="middle" fill="#00ff9d" fontSize="10" fontWeight="bold">1 km</text>
            </g>

            {/* Gulshan -> Bashundhara (5 km) */}
            <g transform="translate(595, 205)">
              <rect x="-20" y="-10" width="40" height="20" rx="10" fill="#090d16" stroke="#1f2d44" strokeWidth="1" />
              <text x="0" y="4" textAnchor="middle" fill="#8ba3c7" fontSize="10" fontWeight="bold">5 km</text>
            </g>

            {/* Dhanmondi -> Mohakhali (8 km) */}
            <g transform="translate(255, 325)">
              <rect x="-20" y="-10" width="40" height="20" rx="10" fill="#090d16" stroke="#1f2d44" strokeWidth="1" />
              <text x="0" y="4" textAnchor="middle" fill="#a78bfa" fontSize="10" fontWeight="bold">8 km</text>
            </g>

            {/* Mohakhali -> Motijheel (9 km) */}
            <g transform="translate(400, 375)">
              <rect x="-20" y="-10" width="40" height="20" rx="10" fill="#090d16" stroke="#1f2d44" strokeWidth="1" />
              <text x="0" y="4" textAnchor="middle" fill="#00ff9d" fontSize="10" fontWeight="bold">9 km</text>
            </g>

            {/* Station Nodes */}
            {Object.entries(ZONE_COORDS).map(([zKey, coord]) => {
              const zone = zKey as Zone
              const isSelected = selectedZone === zone
              const isHighlightedByCorridor =
                !activeCorridor || activeCorridor.stops.includes(zone)

              return (
                <g
                  key={zone}
                  transform={`translate(${coord.x}, ${coord.y})`}
                  onClick={() => setSelectedZone(zone)}
                  className="cursor-pointer group"
                  opacity={isHighlightedByCorridor ? 1 : 0.3}
                >
                  {/* Outer pulse when selected */}
                  {isSelected && (
                    <circle
                      r="26"
                      fill="none"
                      stroke="#00ff9d"
                      strokeWidth="2"
                      opacity="0.5"
                      className="animate-ping"
                    />
                  )}

                  {/* Main Node Circle */}
                  <circle
                    r={isSelected ? '20' : coord.isHub ? '17' : '15'}
                    fill={isSelected ? '#00d4ff' : coord.isHub ? '#16233b' : '#0e1726'}
                    stroke={isSelected ? '#00ff9d' : coord.isHub ? '#00d4ff' : '#2a3a54'}
                    strokeWidth={isSelected ? '3' : '2'}
                    className="transition-all duration-200 group-hover:stroke-[#00ff9d] group-hover:scale-110"
                  />

                  {/* Emoji / Center Icon */}
                  <text
                    textAnchor="middle"
                    y="5"
                    fontSize={isSelected ? '14' : '12'}
                    className="pointer-events-none select-none"
                  >
                    {ZONE_EMOJI[zone]}
                  </text>

                  {/* Zone Label */}
                  <text
                    y={coord.y > 400 ? -28 : 34}
                    textAnchor="middle"
                    fill={isSelected ? '#00ff9d' : '#f0f4ff'}
                    fontSize="13"
                    fontWeight="bold"
                    className="transition-colors group-hover:fill-[#00d4ff]"
                    style={{ textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}
                  >
                    {coord.name}
                  </text>

                  {/* Hub tag */}
                  {coord.isHub && (
                    <text
                      y={coord.y > 400 ? -42 : 47}
                      textAnchor="middle"
                      fill="#00d4ff"
                      fontSize="9"
                      fontWeight="600"
                      letterSpacing="0.5"
                    >
                      CENTRAL JUNCTION
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center justify-between text-xs text-[#4d6080] pt-2 border-t border-[#1f2d44]/30">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-[#00d4ff] rounded" /> Airport Road
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-[#00ff9d] rounded" /> North-South
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-1 bg-[#a78bfa] rounded" /> East-West
            </span>
          </div>
          <span>Distances calculated along physical roadways</span>
        </div>
      </div>

      {/* Selected Zone Inspector: What is Before and What is After */}
      <div className="glass-card p-5 space-y-4 border-l-4 border-l-[#00d4ff]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{ZONE_EMOJI[selectedZone]}</span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#f0f4ff]">
                  {ZONE_COORDS[selectedZone]?.name || selectedZone}
                </h3>
                <span className="text-[10px] uppercase font-bold text-[#00d4ff] bg-[#00d4ff]/10 px-2 py-0.5 rounded border border-[#00d4ff]/20">
                  Inspecting Sequence
                </span>
              </div>
              <p className="text-xs text-[#8ba3c7] mt-0.5">
                {ZONE_COORDS[selectedZone]?.description}
              </p>
            </div>
          </div>

          {/* Quick zone switcher pills */}
          <div className="flex flex-wrap gap-1">
            {ZONES.map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setSelectedZone(z)}
                className={cn(
                  'text-[11px] px-2.5 py-1 rounded-lg font-semibold transition-all',
                  selectedZone === z
                    ? 'bg-[#00ff9d] text-[#090d16] font-bold shadow-md shadow-[#00ff9d]/20'
                    : 'bg-[#162032] text-[#8ba3c7] hover:text-white border border-[#1f2d44]/50'
                )}
              >
                {ZONE_EMOJI[z]} {z}
              </button>
            ))}
          </div>
        </div>

        {/* Before / After Corridor Sequences */}
        <div className="space-y-3 pt-2">
          <h4 className="text-xs font-semibold text-[#4d6080] uppercase tracking-wider flex items-center gap-1.5">
            <ArrowLeftRight className="w-3.5 h-3.5 text-[#00ff9d]" />
            Route Progression (Before &amp; After {ZONE_COORDS[selectedZone]?.name})
          </h4>

          {corridorSequences.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {corridorSequences.map(({ corridor, before, after }) => (
                <div
                  key={corridor.id}
                  className="glass-card-sm p-4 rounded-xl border border-[#1f2d44]/50 space-y-3"
                  style={{ borderLeftColor: corridor.color, borderLeftWidth: 3 }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#f0f4ff]" style={{ color: corridor.color }}>
                      {corridor.name}
                    </span>
                    <span className="text-[10px] text-[#4d6080]">
                      {corridor.stops.length} stops
                    </span>
                  </div>

                  {/* Flow chain visual */}
                  <div className="space-y-2 text-xs">
                    {/* Zones Before */}
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded w-16 text-center shrink-0">
                        Before
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        {before.length > 0 ? (
                          before.map((bZone, i) => (
                            <span key={bZone} className="inline-flex items-center gap-1 text-[#8ba3c7]">
                              {ZONE_EMOJI[bZone]} {bZone}
                              {i < before.length - 1 && (
                                <ArrowRight className="w-3 h-3 text-[#4d6080]" />
                              )}
                            </span>
                          ))
                        ) : (
                          <span className="text-[#4d6080] italic text-[11px]">Origin stop (None before)</span>
                        )}
                      </div>
                    </div>

                    {/* Current Node */}
                    <div className="flex items-center gap-2 bg-[#090d16]/80 p-2 rounded-lg border border-[#1f2d44]">
                      <span className="text-[10px] uppercase font-bold text-[#00ff9d] bg-[#00ff9d]/15 px-2 py-0.5 rounded w-16 text-center shrink-0">
                        Current
                      </span>
                      <span className="font-bold text-[#f0f4ff] flex items-center gap-1">
                        {ZONE_EMOJI[selectedZone]} {selectedZone}
                      </span>
                    </div>

                    {/* Zones After */}
                    <div className="flex items-start gap-2">
                      <span className="text-[10px] uppercase font-bold text-[#00d4ff] bg-[#00d4ff]/10 px-2 py-0.5 rounded w-16 text-center shrink-0">
                        After
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        {after.length > 0 ? (
                          after.map((aZone, i) => (
                            <span key={aZone} className="inline-flex items-center gap-1 text-[#8ba3c7]">
                              {ZONE_EMOJI[aZone]} {aZone}
                              {i < after.length - 1 && (
                                <ArrowRight className="w-3 h-3 text-[#4d6080]" />
                              )}
                            </span>
                          ))
                        ) : (
                          <span className="text-[#4d6080] italic text-[11px]">Terminus stop (None after)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#4d6080]">No passing corridors recorded for this zone.</p>
          )}
        </div>

        {/* Direct Distances from Selected Zone */}
        <div className="mt-4 pt-4 border-t border-[#1f2d44]/50">
          <h4 className="text-xs font-semibold text-[#4d6080] uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#00d4ff]" />
            Road Distance from {ZONE_COORDS[selectedZone]?.name || selectedZone} to other zones
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {ZONES.filter((z) => z !== selectedZone).map((other) => {
              const dist = DISTANCES[selectedZone]?.[other] ?? 0
              return (
                <div
                  key={other}
                  onClick={() => setSelectedZone(other)}
                  className="glass-card-sm p-2.5 rounded-xl border border-[#1f2d44]/50 cursor-pointer hover:border-[#00d4ff]/60 transition-all text-center"
                >
                  <p className="text-[11px] font-semibold text-[#f0f4ff] truncate">
                    {ZONE_EMOJI[other]} {other}
                  </p>
                  <p className="text-xs font-bold text-[#00ff9d] mt-1">{dist} km</p>
                  <p className="text-[9px] text-[#4d6080] mt-0.5">Click to view</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Corridor Linear Steppers (Clean Overview) */}
      <div className="glass-card p-5 space-y-4">
        <h3 className="text-xs font-semibold text-[#4d6080] uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-[#00ff9d]" /> Complete Corridor Progression Steppers
        </h3>

        <div className="space-y-4">
          {CORRIDOR_DEFS.map((c) => (
            <div key={c.id} className="p-4 rounded-2xl bg-[#070b12]/80 border border-[#1f2d44]/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#f0f4ff] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  {c.name}
                </span>
                <span className="text-[11px] text-[#8ba3c7] font-medium">
                  Total distance: {c.distances.reduce((a, b) => a + b, 0)} km
                </span>
              </div>
              <p className="text-xs text-[#4d6080]">{c.description}</p>

              {/* Horizontal Stepper */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {c.stops.map((stop, i) => (
                  <React.Fragment key={stop}>
                    <button
                      type="button"
                      onClick={() => setSelectedZone(stop)}
                      className={cn(
                        'px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5',
                        selectedZone === stop
                          ? 'border-[#00ff9d] bg-[#00ff9d]/20 text-[#00ff9d]'
                          : 'border-[#1f2d44] bg-[#0d1424] text-[#8ba3c7] hover:text-[#f0f4ff]'
                      )}
                    >
                      <span className="text-xs">{i + 1}.</span>
                      <span>{ZONE_EMOJI[stop]} {stop}</span>
                    </button>
                    {i < c.stops.length - 1 && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-[#4d6080]">
                        <ArrowRight className="w-3 h-3 text-[#00d4ff]" />
                        <span>{c.distances[i]} km</span>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

