'use client'

import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ParkingRecommendation } from '@/lib/types'

function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(clsx(inputs))
}

function metersToMinutes(meters: number): string {
  const mins = Math.round(meters / 80)
  return mins <= 1 ? '1 min walk' : `${mins} min walk`
}

function scoreToColorClass(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 50) return 'bg-yellow-500'
  return 'bg-red-500'
}

function scoreToTextClass(score: number): string {
  if (score >= 80) return 'text-green-400'
  if (score >= 50) return 'text-yellow-400'
  return 'text-red-400'
}

interface RecommendationListProps {
  recommendations: ParkingRecommendation[]
  selectedRec: ParkingRecommendation | null
  onSelect: (rec: ParkingRecommendation) => void
  onHover: (rec: ParkingRecommendation | null) => void
}

export default function RecommendationList({
  recommendations,
  selectedRec,
  onSelect,
  onHover,
}: RecommendationListProps) {
  if (recommendations.length === 0) return null

  return (
    <div className="space-y-2">
      {recommendations.map((rec, idx) => {
        const rank = idx + 1
        const isSelected = selectedRec?.meter.space_id === rec.meter.space_id
        const walkMins = Math.round(rec.walk_distance_meters / 80)

        return (
          <button
            key={rec.meter.space_id}
            onClick={() => onSelect(rec)}
            onMouseEnter={() => onHover(rec)}
            onMouseLeave={() => onHover(null)}
            className={cn(
              'w-full text-left rounded-xl border transition-all duration-150 p-4',
              'hover:border-indigo-500/60 hover:bg-slate-800/80',
              'focus:outline-none focus:ring-2 focus:ring-indigo-500',
              isSelected
                ? 'border-indigo-500 bg-slate-800 shadow-lg shadow-indigo-900/20'
                : 'border-slate-700 bg-slate-900'
            )}
          >
            <div className="flex items-start gap-3">
              {/* Rank badge */}
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5',
                  scoreToColorClass(rec.score)
                )}
              >
                #{rank}
              </div>

              <div className="flex-1 min-w-0">
                {/* Address */}
                <p className="text-sm font-medium text-white truncate leading-tight">
                  {rec.meter.street_address}
                </p>

                {/* Stats row */}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
                    </svg>
                    {metersToMinutes(rec.walk_distance_meters)}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    ${rec.total_cost.toFixed(2)} est.
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {rec.meter.time_limit_hours}h limit
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    ${rec.meter.rate_per_hour.toFixed(2)}/hr
                  </span>
                </div>

                {/* Score bar */}
                <div className="mt-2.5">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-500">Score</span>
                    <span className={cn('text-xs font-bold', scoreToTextClass(rec.score))}>
                      {rec.score}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', scoreToColorClass(rec.score))}
                      style={{ width: `${Math.min(100, rec.score)}%` }}
                    />
                  </div>
                </div>

                {/* Risk flags */}
                {rec.risk_flags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {rec.risk_flags.map((flag, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-xs bg-orange-950 text-orange-300 border border-orange-800/50 rounded-full px-2 py-0.5"
                      >
                        <span>&#9888;</span>
                        {flag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Safety pill */}
                <div className="mt-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-0.5',
                      rec.is_safe
                        ? 'bg-green-950 text-green-300 border border-green-800/50'
                        : 'bg-red-950 text-red-300 border border-red-800/50'
                    )}
                  >
                    <span>{rec.is_safe ? '\u2713' : '\u26a0'}</span>
                    {rec.is_safe ? 'Safe to Park' : 'Check Signs'}
                  </span>
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
