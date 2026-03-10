'use client'

import { useState, FormEvent } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ParkingRecommendation } from '@/lib/types'

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs))
}

const DURATION_OPTIONS = [
  { label: '1 hour', value: 1 },
  { label: '2 hours', value: 2 },
  { label: '3 hours', value: 3 },
  { label: '4 hours', value: 4 },
  { label: 'All day (8 hrs)', value: 8 },
]

// Walk speed ~80 m/min; slider is in minutes
function minutesToMeters(minutes: number): number {
  return minutes * 80
}

interface SearchFormProps {
  onResults: (
    recs: ParkingRecommendation[],
    location: { lat: number; lng: number; label: string }
  ) => void
  onLoadingChange: (loading: boolean) => void
}

export default function SearchForm({ onResults, onLoadingChange }: SearchFormProps) {
  const [destination, setDestination] = useState('')
  const [arrivalTime, setArrivalTime] = useState(() => {
    // Default to 1 hour from now
    const d = new Date(Date.now() + 60 * 60 * 1000)
    d.setSeconds(0, 0)
    return d.toISOString().slice(0, 16)
  })
  const [durationHours, setDurationHours] = useState(2)
  const [walkMinutes, setWalkMinutes] = useState(5)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function geocodeDestination(query: string): Promise<{ lat: number; lng: number; label: string } | null> {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.features || data.features.length === 0) return null
    const feature = data.features[0]
    const [lng, lat] = feature.center
    return { lat, lng, label: feature.place_name ?? query }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!destination.trim()) {
      setError('Please enter a destination.')
      return
    }

    setIsSubmitting(true)
    onLoadingChange(true)

    try {
      // Step 1: Geocode
      const location = await geocodeDestination(destination)
      if (!location) {
        setError('Could not find that address. Try a more specific LA location.')
        return
      }

      // Step 2: Call recommendation API
      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination_lat: location.lat,
          destination_lng: location.lng,
          arrival_time: new Date(arrivalTime).toISOString(),
          duration_hours: durationHours,
          walk_radius_meters: minutesToMeters(walkMinutes),
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Failed to fetch recommendations. Please try again.')
        return
      }

      const data = await res.json()
      onResults(data.recommendations ?? [], location)
    } catch (err) {
      console.error(err)
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
      onLoadingChange(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-white mb-1">Find Parking</h1>
        <p className="text-xs text-slate-400">Plan your spot before you leave.</p>
      </div>

      {/* Destination */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-300 uppercase tracking-wider">
          Destination
        </label>
        <input
          type="text"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          placeholder="e.g. Staples Center, Los Angeles"
          className={cn(
            'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5',
            'text-sm text-white placeholder-slate-500',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
            'transition-colors'
          )}
          required
          autoComplete="off"
        />
      </div>

      {/* Arrival time */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-300 uppercase tracking-wider">
          Arrival Time
        </label>
        <input
          type="datetime-local"
          value={arrivalTime}
          onChange={(e) => setArrivalTime(e.target.value)}
          className={cn(
            'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5',
            'text-sm text-white',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
            'transition-colors [color-scheme:dark]'
          )}
          required
        />
      </div>

      {/* Duration */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-300 uppercase tracking-wider">
          How Long Will You Stay?
        </label>
        <select
          value={durationHours}
          onChange={(e) => setDurationHours(Number(e.target.value))}
          className={cn(
            'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2.5',
            'text-sm text-white',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
            'transition-colors'
          )}
        >
          {DURATION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Walk distance slider */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-medium text-slate-300 uppercase tracking-wider">
            Max Walk Distance
          </label>
          <span className="text-xs text-indigo-400 font-medium">
            {walkMinutes} min (~{minutesToMeters(walkMinutes)}m)
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={walkMinutes}
          onChange={(e) => setWalkMinutes(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>1 min</span>
          <span>10 min</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg px-3 py-2 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className={cn(
          'w-full py-3 px-4 rounded-lg font-semibold text-sm transition-all',
          'bg-indigo-500 hover:bg-indigo-600 text-white',
          'focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-950',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'flex items-center justify-center gap-2'
        )}
      >
        {isSubmitting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Searching...
          </>
        ) : (
          'Find Parking'
        )}
      </button>
    </form>
  )
}
