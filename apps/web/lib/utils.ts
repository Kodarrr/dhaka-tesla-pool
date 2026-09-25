import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { RideStage } from './api'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBDT(amount: number) {
  return `৳${amount.toLocaleString('en-BD')}`
}

export function formatPaisa(paisa: number) {
  return formatBDT(Math.round(paisa / 100))
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(iso))
}

export const STAGE_META: Record<RideStage, { label: string; color: string; bg: string }> = {
  REQUESTED:              { label: 'Requested',              color: 'text-amber-400',   bg: 'bg-amber-400/10 border-amber-400/30'   },
  MATCHED:                { label: 'Matched',                color: 'text-violet-400',  bg: 'bg-violet-400/10 border-violet-400/30' },
  DRIVER_ARRIVED:         { label: 'Driver Arrived',         color: 'text-cyan-400',    bg: 'bg-cyan-400/10 border-cyan-400/30'     },
  IN_PROGRESS:            { label: 'In Progress',            color: 'text-blue-400',    bg: 'bg-blue-400/10 border-blue-400/30'     },
  ARRIVED_AT_DESTINATION: { label: 'Arrived at Destination', color: 'text-yellow-400',  bg: 'bg-yellow-400/10 border-yellow-400/30' },
  COMPLETED:              { label: 'Completed',              color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30' },
  CANCELLED:              { label: 'Cancelled',              color: 'text-red-400',     bg: 'bg-red-400/10 border-red-400/30'       },
}

export const ZONE_EMOJI: Record<string, string> = {
  GULSHAN:     '🏢',
  BANANI:      '🌿',
  MOHAKHALI:   '🛣️',
  DHANMONDI:   '🎓',
  UTTARA:      '✈️',
  MOTIJHEEL:   '🏦',
  BASHUNDHARA: '🏡',
}

