'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import SearchForm from '@/components/SearchForm'
import RecommendationList from '@/components/RecommendationList'
import type { ParkingRecommendation } from '@/lib/types'

// Dynamically import the map to avoid SSR issues with mapbox-gl
const ParkingMap = dynamic(() => import('@/components/ParkingMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 text-sm animate-pulse">Loading map...</div>
    </div>
  ),
})

export default function HomePage() {
  const [selectedLocation, setSelectedLocation] = useState<{
    lat: number
    lng: number
    label: string
  } | null>(null)
  const [recommendations, setRecommendations] = useState<ParkingRecommendation[]>(
  []
  )
  const [isLoading, setIsLoading] = useState(false)
  const [selectedRec, setSelectedRec] = useState<ParkingRecommendation | null>(null)
  const [hoveredRec, setHoveredRec] = useState<ParkingRecommendation | null>(null)

  function handleResults(
    recs: ParkingRecommendation[],
    location: { lat: number; lng: number; label: string }
  ) {
    setRecommendations(recs)
    setSelectedLocation(location)
    setSelectedRec(null)
  }

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-65px)]">
      {/* Left panel: search + results */}
      <div className="w-full lg:w-[420px] xl:w-[480px] flex flex-col border-r border-slate-800 overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-800">
          <SearchForm
            onResults={handleResults}
            onLoadingChange={setIsLoading}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm">Finding parking options...</p>
            </div>
          )}

          {!isLoading && recommendations.length === 0 && !selectedLocation && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center text-3xl mb-4">
                🅿️
              </div>
              <h2 className="text-slate-200 font-semibold mb-2">Plan Your Parking</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                Enter your destination, arrival time, and how long you&apos;ll be staying.
                We&apos;ll find the best metered spots nearby.
              </p>
            </div>
          )}

          {!isLoading && recommendations.length === 0 && selectedLocation && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="text-4xl mb-4">🔍</div>
              <p className="text-slate-400 text-sm">
                No parking meters found within your walk distance. Try increasing
                the walk radius.
              </p>
            </div>
          )}

          {!isLoading && recommendations.length > 0 && (
            <div className="p-4">
              <p className="text-xs text-slate-500 mb-3">
                {recommendations.length} options near{' '}
                <span className="text-slate-300">{selectedLocation?.label}</span>
              </p>
              <RecommendationList
                recommendations={recommendations}
                selectedRec={selectedRec}
                onSelect={(rec) => {
                  setSelectedRec(rec)
                  setHoveredRec(rec)
                }}
                onHover={setHoveredRec}
              />
            </div>
          )}
        </div>
      </div>

      {/* Right panel: map */}
      <div className="flex-1 relative min-h-[400px] lg:min-h-0">
        <ParkingMap
          destination={selectedLocation}
          recommendations={recommendations}
          selectedRec={selectedRec}
          hoveredRec={hoveredRec}
          onMarkerClick={(rec) => {
            setSelectedRec(rec)
            setHoveredRec(rec)
          }}
        />
      </div>
    </div>
  )
}
